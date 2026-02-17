from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr
from database import db
from auth import (
    hash_password, verify_password, create_token, 
    generate_verification_token, get_current_user
)
import uuid
from datetime import datetime, timezone
import re
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    business_name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def create_slug(name: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return slug


@router.post("/signup")
async def signup(req: SignupRequest, request: Request):
    existing = await db.users.find_one({'email': req.email.lower()})
    if existing:
        raise HTTPException(400, 'Email already registered')

    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    verification_token = generate_verification_token()
    slug = create_slug(req.business_name)

    existing_slug = await db.tenants.find_one({'slug': slug})
    if existing_slug:
        slug = f"{slug}-{str(uuid.uuid4())[:6]}"

    tenant = {
        'id': tenant_id,
        'name': req.business_name,
        'slug': slug,
        'owner_id': user_id,
        'status': 'active',
        'plan': 'free',
        'timezone': 'Europe/London',
        'default_language': 'en',
        'branding': {},
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    user = {
        'id': user_id,
        'email': req.email.lower(),
        'password_hash': hash_password(req.password),
        'role': 'tenant_owner',
        'tenant_id': tenant_id,
        'name': req.business_name,
        'email_verified': False,
        'verification_token': verification_token,
        'reset_token': None,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    await db.tenants.insert_one(tenant)
    await db.users.insert_one(user)

    # Create default free subscription
    sub = {
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'plan': 'free',
        'status': 'active',
        'stripe_session_id': None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.subscriptions.insert_one(sub)

    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user_id,
        'action': 'signup',
        'details': f'Tenant {req.business_name} created',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    return {
        'message': 'Account created. Please verify your email.',
        'verification_token': verification_token,
        'user_id': user_id,
        'tenant_id': tenant_id
    }


@router.post("/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({'email': req.email.lower()}, {'_id': 0})
    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(401, 'Invalid email or password')

    if user.get('role') != 'super_admin' and not user.get('email_verified'):
        raise HTTPException(403, 'Please verify your email first')

    # Check tenant status
    if user.get('tenant_id'):
        tenant = await db.tenants.find_one({'id': user['tenant_id']}, {'_id': 0})
        if tenant and tenant.get('status') == 'suspended':
            raise HTTPException(403, 'Your account has been suspended')

    token = create_token(user['id'], user['role'], user.get('tenant_id'))

    return {
        'token': token,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user.get('name', ''),
            'role': user['role'],
            'tenant_id': user.get('tenant_id'),
            'email_verified': user.get('email_verified', False)
        }
    }


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    tenant = None
    if user.get('tenant_id'):
        tenant = await db.tenants.find_one({'id': user['tenant_id']}, {'_id': 0})
    return {
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user.get('name', ''),
            'role': user['role'],
            'tenant_id': user.get('tenant_id'),
            'email_verified': user.get('email_verified', False)
        },
        'tenant': tenant
    }


@router.post("/verify-email")
async def verify_email(req: VerifyEmailRequest):
    user = await db.users.find_one({'verification_token': req.token}, {'_id': 0})
    if not user:
        raise HTTPException(400, 'Invalid verification token')

    await db.users.update_one(
        {'id': user['id']},
        {'$set': {'email_verified': True, 'verification_token': None, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    return {'message': 'Email verified successfully'}


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    user = await db.users.find_one({'email': req.email.lower()}, {'_id': 0})
    if not user:
        return {'message': 'If an account exists, a reset link has been sent.'}

    reset_token = generate_verification_token()
    await db.users.update_one(
        {'id': user['id']},
        {'$set': {'reset_token': reset_token, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    return {'message': 'If an account exists, a reset link has been sent.', 'reset_token': reset_token}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    user = await db.users.find_one({'reset_token': req.token}, {'_id': 0})
    if not user:
        raise HTTPException(400, 'Invalid reset token')

    await db.users.update_one(
        {'id': user['id']},
        {'$set': {
            'password_hash': hash_password(req.new_password),
            'reset_token': None,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    return {'message': 'Password reset successfully'}
