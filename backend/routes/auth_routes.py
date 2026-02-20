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
    # Basic info
    first_name: str
    last_name: str
    company_name: str
    phone: str
    email: str
    password: str
    gdpr_consent: bool = True
    # Optional fields that can be filled later
    address: str = ""
    city: str = ""
    postal_code: str = ""
    country: str = "France"
    registration_number: str = ""  # SIRET/SIREN
    vat_number: str = ""


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
    # Validate GDPR consent
    if not req.gdpr_consent:
        raise HTTPException(400, 'GDPR consent is required')
    
    existing = await db.users.find_one({'email': req.email.lower()})
    if existing:
        raise HTTPException(400, 'Email already registered')

    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    slug = create_slug(req.company_name)

    existing_slug = await db.tenants.find_one({'slug': slug})
    if existing_slug:
        slug = f"{slug}-{str(uuid.uuid4())[:6]}"

    # Full tenant profile with business details
    tenant = {
        'id': tenant_id,
        'name': req.company_name,
        'slug': slug,
        'owner_id': user_id,
        'status': 'active',
        'plan': 'free',
        'timezone': 'Europe/Paris',
        'default_language': 'fr',
        # Business profile
        'profile': {
            'manager_first_name': req.first_name,
            'manager_last_name': req.last_name,
            'company_name': req.company_name,
            'address': req.address,
            'city': req.city,
            'postal_code': req.postal_code,
            'country': req.country,
            'phone': req.phone,
            'email': req.email.lower(),
            'registration_number': req.registration_number,
            'vat_number': req.vat_number,
            'logo_url': '',
            'google_review_url': '',
            'social_links': {}
        },
        'branding': {
            'primary_color': '#6366f1',
            'secondary_color': '#8b5cf6',
            'logo_url': ''
        },
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    user = {
        'id': user_id,
        'email': req.email.lower(),
        'password_hash': hash_password(req.password),
        'role': 'tenant_owner',
        'tenant_id': tenant_id,
        'first_name': req.first_name,
        'last_name': req.last_name,
        'name': f"{req.first_name} {req.last_name}",
        'phone': req.phone,
        'email_verified': True,  # Auto-verify for simpler flow
        'verification_token': None,
        'reset_token': None,
        'gdpr_consent': True,
        'gdpr_consent_date': datetime.now(timezone.utc).isoformat(),
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
        'category': 'auth',
        'details': f'Tenant {req.company_name} created by {req.first_name} {req.last_name}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    # Auto-login after signup
    token = create_token(user_id, 'tenant_owner', tenant_id)

    return {
        'message': 'Account created successfully',
        'token': token,
        'user': {
            'id': user_id,
            'email': user['email'],
            'name': user['name'],
            'role': 'tenant_owner',
            'tenant_id': tenant_id,
            'email_verified': True
        },
        'tenant': {
            'id': tenant_id,
            'name': tenant['name'],
            'slug': slug,
            'plan': 'free'
        },
        'show_plan_selection': True  # Flag to show plan popup
    }


@router.post("/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({'email': req.email.lower()}, {'_id': 0})
    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(401, 'Invalid email or password')

    # Check tenant status
    tenant = None
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
            'first_name': user.get('first_name', ''),
            'last_name': user.get('last_name', ''),
            'role': user['role'],
            'tenant_id': user.get('tenant_id'),
            'email_verified': user.get('email_verified', True)
        },
        'tenant': tenant
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
