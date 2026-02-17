import jwt
import bcrypt
import os
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends

JWT_SECRET = os.environ.get('JWT_SECRET', 'default-jwt-secret')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_HOURS = 24


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def hash_identifier(value: str) -> str:
    return hashlib.sha256(value.lower().strip().encode('utf-8')).hexdigest()


def create_token(user_id: str, role: str, tenant_id: str = None) -> str:
    payload = {
        'sub': user_id,
        'role': role,
        'tenant_id': tenant_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        'iat': datetime.now(timezone.utc),
        'jti': str(uuid.uuid4())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')


def generate_verification_token() -> str:
    return str(uuid.uuid4())


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Not authenticated')
    token = auth_header[7:]
    payload = decode_token(token)
    from database import db
    user = await db.users.find_one({'id': payload['sub']}, {'_id': 0})
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    if not user.get('email_verified') and user.get('role') != 'super_admin':
        raise HTTPException(status_code=403, detail='Email not verified')
    return user


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user['role'] != 'super_admin':
        raise HTTPException(status_code=403, detail='Super admin access required')
    return user


async def require_tenant_owner(user: dict = Depends(get_current_user)) -> dict:
    if user['role'] not in ('tenant_owner', 'super_admin'):
        raise HTTPException(status_code=403, detail='Tenant owner access required')
    return user


async def require_tenant_access(user: dict = Depends(get_current_user)) -> dict:
    if user['role'] not in ('tenant_owner', 'tenant_staff', 'super_admin'):
        raise HTTPException(status_code=403, detail='Tenant access required')
    return user
