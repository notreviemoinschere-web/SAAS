from fastapi import APIRouter, HTTPException, Request, Depends, Query
from pydantic import BaseModel
from database import db
from auth import require_super_admin, hash_password, get_current_user
import uuid
from datetime import datetime, timezone
from typing import Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


class CreateTenantRequest(BaseModel):
    business_name: str
    email: str
    password: str


class UpdateTenantStatusRequest(BaseModel):
    status: str


@router.get("/dashboard")
async def admin_dashboard(user: dict = Depends(require_super_admin)):
    total_tenants = await db.tenants.count_documents({})
    active_campaigns = await db.campaigns.count_documents({'status': 'active'})
    total_plays = await db.plays.count_documents({})
    total_players = await db.players.count_documents({})
    fraud_alerts = await db.fraud_flags.count_documents({})
    total_revenue = 0
    transactions = await db.payment_transactions.find(
        {'payment_status': 'paid'}, {'_id': 0, 'amount': 1}
    ).to_list(10000)
    total_revenue = sum(t.get('amount', 0) for t in transactions)

    recent_tenants = await db.tenants.find({}, {'_id': 0}).sort('created_at', -1).to_list(5)
    recent_plays = await db.plays.find({}, {'_id': 0}).sort('created_at', -1).to_list(10)

    plan_breakdown = {}
    for plan in ['free', 'pro', 'business']:
        count = await db.tenants.count_documents({'plan': plan})
        plan_breakdown[plan] = count

    return {
        'total_tenants': total_tenants,
        'active_campaigns': active_campaigns,
        'total_plays': total_plays,
        'total_players': total_players,
        'fraud_alerts': fraud_alerts,
        'total_revenue': total_revenue,
        'plan_breakdown': plan_breakdown,
        'recent_tenants': recent_tenants,
        'recent_plays': recent_plays
    }


@router.get("/tenants")
async def list_tenants(
    user: dict = Depends(require_super_admin),
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    status: Optional[str] = None
):
    query = {}
    if search:
        query['name'] = {'$regex': search, '$options': 'i'}
    if status:
        query['status'] = status

    tenants = await db.tenants.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.tenants.count_documents(query)

    for t in tenants:
        t['campaign_count'] = await db.campaigns.count_documents({'tenant_id': t['id']})
        t['play_count'] = await db.plays.count_documents({'tenant_id': t['id']})
        owner = await db.users.find_one({'id': t['owner_id']}, {'_id': 0, 'email': 1, 'name': 1})
        t['owner'] = owner

    return {'tenants': tenants, 'total': total}


@router.post("/tenants")
async def create_tenant(req: CreateTenantRequest, request: Request, user: dict = Depends(require_super_admin)):
    existing = await db.users.find_one({'email': req.email.lower()})
    if existing:
        raise HTTPException(400, 'Email already registered')

    import re
    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    slug = re.sub(r'[^a-z0-9]+', '-', req.business_name.lower()).strip('-')

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

    new_user = {
        'id': user_id,
        'email': req.email.lower(),
        'password_hash': hash_password(req.password),
        'role': 'tenant_owner',
        'tenant_id': tenant_id,
        'name': req.business_name,
        'email_verified': True,
        'verification_token': None,
        'reset_token': None,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    await db.tenants.insert_one(tenant)
    await db.users.insert_one(new_user)
    await db.subscriptions.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'plan': 'free',
        'status': 'active',
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_create_tenant',
        'details': f'Admin created tenant {req.business_name}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    return {'message': 'Tenant created', 'tenant_id': tenant_id}


@router.put("/tenants/{tenant_id}/status")
async def update_tenant_status(
    tenant_id: str,
    req: UpdateTenantStatusRequest,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    if req.status not in ('active', 'suspended'):
        raise HTTPException(400, 'Invalid status')

    tenant = await db.tenants.find_one({'id': tenant_id}, {'_id': 0})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')

    await db.tenants.update_one(
        {'id': tenant_id},
        {'$set': {'status': req.status, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )

    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': f'admin_{req.status}_tenant',
        'details': f'Admin set tenant {tenant["name"]} to {req.status}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    return {'message': f'Tenant {req.status}'}


@router.get("/audit-logs")
async def get_audit_logs(
    user: dict = Depends(require_super_admin),
    skip: int = 0,
    limit: int = 50,
    tenant_id: Optional[str] = None
):
    query = {}
    if tenant_id:
        query['tenant_id'] = tenant_id
    logs = await db.audit_logs.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents(query)
    return {'logs': logs, 'total': total}


@router.get("/fraud")
async def get_fraud_flags(
    user: dict = Depends(require_super_admin),
    skip: int = 0,
    limit: int = 50
):
    flags = await db.fraud_flags.find({}, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.fraud_flags.count_documents({})
    return {'flags': flags, 'total': total}
