"""
Extended Admin Routes for Super Admin Panel
Includes: Plans CRUD, Platform Settings, Tenant Details, Messaging, Exports, Fraud Center
"""
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Response
from pydantic import BaseModel, Field
from database import db
from auth import require_super_admin, get_current_user
from crypto_utils import encrypt_value, decrypt_value, mask_key
import uuid
import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin-extended"])


# ==================== PYDANTIC MODELS ====================

class PlanCreate(BaseModel):
    id: str
    name: str
    price_monthly: float = 0
    price_yearly: float = 0
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_yearly: Optional[str] = None
    limits: dict = Field(default_factory=dict)
    features: List[str] = Field(default_factory=list)
    is_active: bool = True
    sort_order: int = 0


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_yearly: Optional[str] = None
    limits: Optional[dict] = None
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class StripeSettingsUpdate(BaseModel):
    test_secret_key: Optional[str] = None
    live_secret_key: Optional[str] = None
    test_publishable_key: Optional[str] = None
    live_publishable_key: Optional[str] = None
    webhook_secret: Optional[str] = None
    mode: Optional[str] = None  # 'test' or 'live'


class ChangePlanRequest(BaseModel):
    plan_id: str
    reason: Optional[str] = None


class AdminMessageCreate(BaseModel):
    title: str
    content: str
    message_type: str = "info"  # info, warning, urgent, maintenance
    target_type: str = "broadcast"  # broadcast, targeted
    target_tenant_ids: List[str] = Field(default_factory=list)
    expires_at: Optional[str] = None


class BanRequest(BaseModel):
    ban_type: str  # ip, device, identity
    value: str
    reason: Optional[str] = None
    expires_at: Optional[str] = None


class TenantNoteCreate(BaseModel):
    content: str


# ==================== PLANS CRUD ====================

@router.get("/plans")
async def list_plans(user: dict = Depends(require_super_admin)):
    """List all subscription plans with full details."""
    plans = await db.plans.find({}, {'_id': 0}).sort('sort_order', 1).to_list(100)
    return {'plans': plans}


@router.post("/plans")
async def create_plan(req: PlanCreate, request: Request, user: dict = Depends(require_super_admin)):
    """Create a new subscription plan."""
    existing = await db.plans.find_one({'id': req.id})
    if existing:
        raise HTTPException(400, 'Plan ID already exists')
    
    plan = {
        **req.model_dump(),
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.plans.insert_one(plan)
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': None,
        'user_id': user['id'],
        'action': 'admin_create_plan',
        'category': 'billing',
        'details': f'Created plan: {req.name} ({req.id})',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    plan.pop('_id', None)
    return plan


@router.put("/plans/{plan_id}")
async def update_plan(plan_id: str, req: PlanUpdate, request: Request, user: dict = Depends(require_super_admin)):
    """Update an existing plan."""
    plan = await db.plans.find_one({'id': plan_id})
    if not plan:
        raise HTTPException(404, 'Plan not found')
    
    update = {k: v for k, v in req.model_dump().items() if v is not None}
    update['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.plans.update_one({'id': plan_id}, {'$set': update})
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': None,
        'user_id': user['id'],
        'action': 'admin_update_plan',
        'category': 'billing',
        'details': f'Updated plan: {plan_id}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    updated = await db.plans.find_one({'id': plan_id}, {'_id': 0})
    return updated


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, request: Request, user: dict = Depends(require_super_admin)):
    """Delete a plan (soft delete by setting is_active=False)."""
    if plan_id == 'free':
        raise HTTPException(400, 'Cannot delete the free plan')
    
    plan = await db.plans.find_one({'id': plan_id})
    if not plan:
        raise HTTPException(404, 'Plan not found')
    
    # Check if any tenants are using this plan
    tenant_count = await db.tenants.count_documents({'plan': plan_id})
    if tenant_count > 0:
        raise HTTPException(400, f'Cannot delete plan: {tenant_count} tenants are using it')
    
    await db.plans.update_one({'id': plan_id}, {'$set': {'is_active': False, 'updated_at': datetime.now(timezone.utc).isoformat()}})
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': None,
        'user_id': user['id'],
        'action': 'admin_delete_plan',
        'category': 'billing',
        'details': f'Deactivated plan: {plan_id}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {'message': 'Plan deactivated'}


# ==================== STRIPE SETTINGS ====================

@router.get("/settings/billing")
async def get_billing_settings(user: dict = Depends(require_super_admin)):
    """Get Stripe configuration (keys are masked for security)."""
    settings = await db.platform_settings.find_one({'setting_type': 'stripe'}, {'_id': 0})
    
    if not settings:
        return {
            'mode': 'test',
            'test_secret_key': '',
            'live_secret_key': '',
            'test_publishable_key': '',
            'live_publishable_key': '',
            'webhook_secret': '',
            'test_secret_key_masked': '',
            'live_secret_key_masked': ''
        }
    
    # Decrypt and mask keys for display
    test_sk = decrypt_value(settings.get('test_secret_key_encrypted', ''))
    live_sk = decrypt_value(settings.get('live_secret_key_encrypted', ''))
    
    return {
        'mode': settings.get('mode', 'test'),
        'test_secret_key_masked': mask_key(test_sk) if test_sk else '',
        'live_secret_key_masked': mask_key(live_sk) if live_sk else '',
        'test_publishable_key': settings.get('test_publishable_key', ''),
        'live_publishable_key': settings.get('live_publishable_key', ''),
        'webhook_secret_masked': mask_key(settings.get('webhook_secret', '')) if settings.get('webhook_secret') else '',
        'has_test_key': bool(test_sk),
        'has_live_key': bool(live_sk)
    }


@router.patch("/settings/billing")
async def update_billing_settings(req: StripeSettingsUpdate, request: Request, user: dict = Depends(require_super_admin)):
    """Update Stripe configuration. Keys are encrypted at rest."""
    settings = await db.platform_settings.find_one({'setting_type': 'stripe'})
    
    update = {'setting_type': 'stripe', 'updated_at': datetime.now(timezone.utc).isoformat()}
    
    # Encrypt secret keys
    if req.test_secret_key is not None:
        update['test_secret_key_encrypted'] = encrypt_value(req.test_secret_key)
    if req.live_secret_key is not None:
        update['live_secret_key_encrypted'] = encrypt_value(req.live_secret_key)
    if req.webhook_secret is not None:
        update['webhook_secret'] = req.webhook_secret
    
    # Store publishable keys as-is (they're public)
    if req.test_publishable_key is not None:
        update['test_publishable_key'] = req.test_publishable_key
    if req.live_publishable_key is not None:
        update['live_publishable_key'] = req.live_publishable_key
    if req.mode is not None:
        if req.mode not in ('test', 'live'):
            raise HTTPException(400, 'Mode must be "test" or "live"')
        update['mode'] = req.mode
    
    if settings:
        await db.platform_settings.update_one({'setting_type': 'stripe'}, {'$set': update})
    else:
        update['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.platform_settings.insert_one(update)
    
    # Log sensitive action
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': None,
        'user_id': user['id'],
        'action': 'admin_update_stripe_settings',
        'category': 'security',
        'details': 'Updated Stripe configuration',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {'message': 'Billing settings updated'}


# ==================== ENHANCED TENANTS ====================

@router.get("/tenants/list")
async def list_tenants_enhanced(
    user: dict = Depends(require_super_admin),
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    status: Optional[str] = None,
    plan: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
):
    """List tenants with advanced filtering and sorting."""
    query = {}
    
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'slug': {'$regex': search, '$options': 'i'}}
        ]
    if status:
        query['status'] = status
    if plan:
        query['plan'] = plan
    
    sort_dir = -1 if sort_order == "desc" else 1
    
    tenants = await db.tenants.find(query, {'_id': 0}).sort(sort_by, sort_dir).skip(skip).limit(limit).to_list(limit)
    total = await db.tenants.count_documents(query)
    
    # Enrich with stats
    for t in tenants:
        tid = t['id']
        t['campaign_count'] = await db.campaigns.count_documents({'tenant_id': tid})
        t['active_campaign_count'] = await db.campaigns.count_documents({'tenant_id': tid, 'status': 'active'})
        t['play_count'] = await db.plays.count_documents({'tenant_id': tid, 'is_test': {'$ne': True}})
        t['player_count'] = await db.players.count_documents({'tenant_id': tid})
        
        # Get owner info
        owner = await db.users.find_one({'id': t.get('owner_id')}, {'_id': 0, 'email': 1, 'name': 1})
        t['owner'] = owner
        
        # Get subscription info
        sub = await db.subscriptions.find_one({'tenant_id': tid}, {'_id': 0})
        t['subscription'] = sub
        
        # Monthly plays this month
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()
        t['plays_this_month'] = await db.plays.count_documents({
            'tenant_id': tid, 
            'is_test': {'$ne': True},
            'created_at': {'$gte': month_start}
        })
    
    return {'tenants': tenants, 'total': total}


@router.get("/tenants/{tenant_id}")
async def get_tenant_detail(tenant_id: str, user: dict = Depends(require_super_admin)):
    """Get detailed tenant information with stats, campaigns, billing, and notes."""
    tenant = await db.tenants.find_one({'id': tenant_id}, {'_id': 0})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    # Owner info
    owner = await db.users.find_one({'id': tenant.get('owner_id')}, {'_id': 0, 'password_hash': 0})
    
    # Staff members
    staff = await db.users.find(
        {'tenant_id': tenant_id, 'role': 'tenant_staff'},
        {'_id': 0, 'password_hash': 0}
    ).to_list(100)
    
    # Campaigns
    campaigns = await db.campaigns.find({'tenant_id': tenant_id}, {'_id': 0}).sort('created_at', -1).to_list(100)
    for c in campaigns:
        c['play_count'] = await db.plays.count_documents({'campaign_id': c['id'], 'is_test': {'$ne': True}})
        c['prize_count'] = await db.prizes.count_documents({'campaign_id': c['id']})
    
    # Stats
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()
    stats = {
        'total_campaigns': await db.campaigns.count_documents({'tenant_id': tenant_id}),
        'active_campaigns': await db.campaigns.count_documents({'tenant_id': tenant_id, 'status': 'active'}),
        'total_plays': await db.plays.count_documents({'tenant_id': tenant_id, 'is_test': {'$ne': True}}),
        'plays_this_month': await db.plays.count_documents({
            'tenant_id': tenant_id,
            'is_test': {'$ne': True},
            'created_at': {'$gte': month_start}
        }),
        'total_players': await db.players.count_documents({'tenant_id': tenant_id}),
        'rewards_issued': await db.reward_codes.count_documents({'tenant_id': tenant_id}),
        'rewards_redeemed': await db.reward_codes.count_documents({'tenant_id': tenant_id, 'status': 'redeemed'})
    }
    
    # Recent plays (last 7 days)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    daily_plays = []
    for i in range(7):
        day = datetime.now(timezone.utc) - timedelta(days=6-i)
        day_str = day.strftime('%Y-%m-%d')
        count = await db.plays.count_documents({
            'tenant_id': tenant_id,
            'is_test': {'$ne': True},
            'created_at': {'$regex': f'^{day_str}'}
        })
        daily_plays.append({'date': day_str, 'plays': count})
    stats['daily_plays'] = daily_plays
    
    # Billing info
    subscription = await db.subscriptions.find_one({'tenant_id': tenant_id}, {'_id': 0})
    invoices = await db.payment_transactions.find(
        {'tenant_id': tenant_id},
        {'_id': 0}
    ).sort('created_at', -1).to_list(20)
    
    # Admin notes
    notes = await db.tenant_notes.find(
        {'tenant_id': tenant_id},
        {'_id': 0}
    ).sort('created_at', -1).to_list(50)
    
    # Plan limits
    plan_data = await db.plans.find_one({'id': tenant.get('plan', 'free')}, {'_id': 0})
    
    return {
        'tenant': tenant,
        'owner': owner,
        'staff': staff,
        'campaigns': campaigns,
        'stats': stats,
        'billing': {
            'subscription': subscription,
            'invoices': invoices,
            'plan': plan_data
        },
        'notes': notes
    }


@router.put("/tenants/{tenant_id}/plan")
async def change_tenant_plan(
    tenant_id: str,
    req: ChangePlanRequest,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Change a tenant's subscription plan (admin override)."""
    tenant = await db.tenants.find_one({'id': tenant_id}, {'_id': 0})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    plan = await db.plans.find_one({'id': req.plan_id}, {'_id': 0})
    if not plan:
        raise HTTPException(400, 'Invalid plan')
    
    old_plan = tenant.get('plan', 'free')
    
    await db.tenants.update_one(
        {'id': tenant_id},
        {'$set': {'plan': req.plan_id, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.subscriptions.update_one(
        {'tenant_id': tenant_id},
        {'$set': {
            'plan': req.plan_id,
            'admin_override': True,
            'admin_override_reason': req.reason,
            'admin_override_by': user['id'],
            'updated_at': datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_change_plan',
        'category': 'billing',
        'details': f'Changed plan from {old_plan} to {req.plan_id}. Reason: {req.reason or "N/A"}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {'message': f'Plan changed to {req.plan_id}'}


@router.post("/tenants/{tenant_id}/cancel-subscription")
async def cancel_tenant_subscription(
    tenant_id: str,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Cancel a tenant's subscription and revert to free plan."""
    tenant = await db.tenants.find_one({'id': tenant_id}, {'_id': 0})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    old_plan = tenant.get('plan', 'free')
    
    await db.tenants.update_one(
        {'id': tenant_id},
        {'$set': {'plan': 'free', 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.subscriptions.update_one(
        {'tenant_id': tenant_id},
        {'$set': {
            'plan': 'free',
            'status': 'cancelled',
            'cancelled_at': datetime.now(timezone.utc).isoformat(),
            'cancelled_by': user['id'],
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_cancel_subscription',
        'category': 'billing',
        'details': f'Cancelled subscription. Previous plan: {old_plan}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {'message': 'Subscription cancelled, reverted to free plan'}


@router.post("/tenants/{tenant_id}/notes")
async def add_tenant_note(
    tenant_id: str,
    req: TenantNoteCreate,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Add an internal admin note to a tenant."""
    tenant = await db.tenants.find_one({'id': tenant_id})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    note = {
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'content': req.content,
        'created_by': user['id'],
        'created_by_email': user.get('email', ''),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.tenant_notes.insert_one(note)
    note.pop('_id', None)
    return note


@router.delete("/tenants/{tenant_id}/notes/{note_id}")
async def delete_tenant_note(
    tenant_id: str,
    note_id: str,
    user: dict = Depends(require_super_admin)
):
    """Delete an admin note."""
    result = await db.tenant_notes.delete_one({'id': note_id, 'tenant_id': tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(404, 'Note not found')
    return {'message': 'Note deleted'}


# ==================== CONSENT-GATED EXPORTS ====================

@router.get("/tenants/{tenant_id}/exports/players.csv")
async def export_tenant_players(
    tenant_id: str,
    request: Request,
    user: dict = Depends(require_super_admin),
    anonymize: bool = False
):
    """Export tenant players. Consent-gated: only include PII if marketing consent exists."""
    tenant = await db.tenants.find_one({'id': tenant_id})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    players = await db.players.find({'tenant_id': tenant_id}, {'_id': 0}).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    headers = ['player_id', 'campaign_id', 'plays_count', 'created_at']
    if not anonymize:
        headers = ['player_id', 'email', 'phone', 'campaign_id', 'plays_count', 'created_at', 'has_marketing_consent']
    
    writer.writerow(headers)
    
    for p in players:
        # Check consent
        consent = await db.consents.find_one({
            'player_id': p['id'],
            'consent_type': 'marketing'
        })
        has_consent = consent is not None
        
        if anonymize:
            writer.writerow([
                p.get('id', ''),
                p.get('campaign_id', ''),
                p.get('plays_count', 0),
                p.get('created_at', '')
            ])
        else:
            # Only show PII if consent exists
            email = p.get('email', '') if has_consent else '[REDACTED]'
            phone = p.get('phone', '') if has_consent else '[REDACTED]'
            
            writer.writerow([
                p.get('id', ''),
                email,
                phone,
                p.get('campaign_id', ''),
                p.get('plays_count', 0),
                p.get('created_at', ''),
                'yes' if has_consent else 'no'
            ])
    
    # Log export action
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_export_players',
        'category': 'data_export',
        'details': f'Exported {len(players)} players. Anonymized: {anonymize}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=players_{tenant_id}_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@router.get("/tenants/{tenant_id}/exports/plays.csv")
async def export_tenant_plays(
    tenant_id: str,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Export tenant plays (anonymized by default)."""
    tenant = await db.tenants.find_one({'id': tenant_id})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    plays = await db.plays.find({'tenant_id': tenant_id, 'is_test': {'$ne': True}}, {'_id': 0}).to_list(50000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['play_id', 'campaign_id', 'player_id', 'prize_id', 'reward_code', 'created_at'])
    
    for p in plays:
        writer.writerow([
            p.get('id', ''),
            p.get('campaign_id', ''),
            p.get('player_id', ''),
            p.get('prize_id', ''),
            p.get('reward_code', ''),
            p.get('created_at', '')
        ])
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_export_plays',
        'category': 'data_export',
        'details': f'Exported {len(plays)} plays',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=plays_{tenant_id}_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@router.get("/tenants/{tenant_id}/exports/codes.csv")
async def export_tenant_codes(
    tenant_id: str,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Export reward codes."""
    tenant = await db.tenants.find_one({'id': tenant_id})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    codes = await db.reward_codes.find({'tenant_id': tenant_id}, {'_id': 0}).to_list(50000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['code', 'campaign_id', 'prize_id', 'status', 'created_at', 'redeemed_at'])
    
    for c in codes:
        writer.writerow([
            c.get('code', ''),
            c.get('campaign_id', ''),
            c.get('prize_id', ''),
            c.get('status', ''),
            c.get('created_at', ''),
            c.get('redeemed_at', '')
        ])
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_export_codes',
        'category': 'data_export',
        'details': f'Exported {len(codes)} reward codes',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=codes_{tenant_id}_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


# ==================== ADMIN MESSAGING ====================

@router.get("/messages")
async def list_admin_messages(
    user: dict = Depends(require_super_admin),
    skip: int = 0,
    limit: int = 50
):
    """List all admin messages."""
    messages = await db.admin_messages.find({}, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.admin_messages.count_documents({})
    
    # Enrich with read stats
    for m in messages:
        if m.get('target_type') == 'broadcast':
            total_tenants = await db.tenants.count_documents({})
            read_count = await db.tenant_message_reads.count_documents({'message_id': m['id']})
            m['read_count'] = read_count
            m['total_recipients'] = total_tenants
        else:
            target_count = len(m.get('target_tenant_ids', []))
            read_count = await db.tenant_message_reads.count_documents({'message_id': m['id']})
            m['read_count'] = read_count
            m['total_recipients'] = target_count
    
    return {'messages': messages, 'total': total}


@router.post("/messages")
async def create_admin_message(req: AdminMessageCreate, request: Request, user: dict = Depends(require_super_admin)):
    """Create a new admin message (broadcast or targeted)."""
    message = {
        'id': str(uuid.uuid4()),
        'title': req.title,
        'content': req.content,
        'message_type': req.message_type,
        'target_type': req.target_type,
        'target_tenant_ids': req.target_tenant_ids if req.target_type == 'targeted' else [],
        'expires_at': req.expires_at,
        'created_by': user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.admin_messages.insert_one(message)
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': None,
        'user_id': user['id'],
        'action': 'admin_create_message',
        'category': 'messaging',
        'details': f'Created {req.target_type} message: {req.title}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    message.pop('_id', None)
    return message


@router.delete("/messages/{message_id}")
async def delete_admin_message(message_id: str, user: dict = Depends(require_super_admin)):
    """Delete an admin message."""
    result = await db.admin_messages.delete_one({'id': message_id})
    if result.deleted_count == 0:
        raise HTTPException(404, 'Message not found')
    
    # Also delete read receipts
    await db.tenant_message_reads.delete_many({'message_id': message_id})
    
    return {'message': 'Message deleted'}


# ==================== ENHANCED AUDIT LOGS ====================

@router.get("/audit-logs/enhanced")
async def get_audit_logs_enhanced(
    user: dict = Depends(require_super_admin),
    skip: int = 0,
    limit: int = 100,
    tenant_id: Optional[str] = None,
    action: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Enhanced audit logs with filters."""
    query = {}
    
    if tenant_id:
        query['tenant_id'] = tenant_id
    if action:
        query['action'] = {'$regex': action, '$options': 'i'}
    if category:
        query['category'] = category
    if user_id:
        query['user_id'] = user_id
    if date_from:
        query['created_at'] = {'$gte': date_from}
    if date_to:
        if 'created_at' in query:
            query['created_at']['$lte'] = date_to
        else:
            query['created_at'] = {'$lte': date_to}
    
    logs = await db.audit_logs.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents(query)
    
    # Get unique categories and actions for filters
    categories = await db.audit_logs.distinct('category')
    actions = await db.audit_logs.distinct('action')
    
    return {
        'logs': logs,
        'total': total,
        'filters': {
            'categories': [c for c in categories if c],
            'actions': [a for a in actions if a]
        }
    }


# ==================== FRAUD CENTER ====================

@router.get("/fraud/bans")
async def list_bans(
    user: dict = Depends(require_super_admin),
    ban_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """List all active bans (IPs, devices, identities)."""
    result = {
        'banned_ips': [],
        'banned_devices': [],
        'blacklisted_identities': [],
        'total': 0
    }
    
    if not ban_type or ban_type == 'ip':
        ips = await db.banned_ips.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)
        result['banned_ips'] = ips
    
    if not ban_type or ban_type == 'device':
        devices = await db.banned_devices.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)
        result['banned_devices'] = devices
    
    if not ban_type or ban_type == 'identity':
        identities = await db.blacklisted_identities.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)
        result['blacklisted_identities'] = identities
    
    result['total'] = len(result['banned_ips']) + len(result['banned_devices']) + len(result['blacklisted_identities'])
    
    return result


@router.post("/fraud/bans")
async def create_ban(req: BanRequest, request: Request, user: dict = Depends(require_super_admin)):
    """Create a new ban (IP, device, or identity hash)."""
    ban = {
        'id': str(uuid.uuid4()),
        'value': req.value,
        'reason': req.reason,
        'expires_at': req.expires_at,
        'created_by': user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    if req.ban_type == 'ip':
        existing = await db.banned_ips.find_one({'value': req.value})
        if existing:
            raise HTTPException(400, 'IP already banned')
        await db.banned_ips.insert_one(ban)
    elif req.ban_type == 'device':
        existing = await db.banned_devices.find_one({'value': req.value})
        if existing:
            raise HTTPException(400, 'Device already banned')
        await db.banned_devices.insert_one(ban)
    elif req.ban_type == 'identity':
        existing = await db.blacklisted_identities.find_one({'value': req.value})
        if existing:
            raise HTTPException(400, 'Identity already blacklisted')
        await db.blacklisted_identities.insert_one(ban)
    else:
        raise HTTPException(400, 'Invalid ban type')
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': None,
        'user_id': user['id'],
        'action': f'admin_ban_{req.ban_type}',
        'category': 'security',
        'details': f'Banned {req.ban_type}: {req.value}. Reason: {req.reason or "N/A"}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    ban.pop('_id', None)
    return ban


@router.delete("/fraud/bans/{ban_type}/{ban_id}")
async def remove_ban(ban_type: str, ban_id: str, request: Request, user: dict = Depends(require_super_admin)):
    """Remove a ban."""
    collection = None
    if ban_type == 'ip':
        collection = db.banned_ips
    elif ban_type == 'device':
        collection = db.banned_devices
    elif ban_type == 'identity':
        collection = db.blacklisted_identities
    else:
        raise HTTPException(400, 'Invalid ban type')
    
    ban = await collection.find_one({'id': ban_id}, {'_id': 0})
    if not ban:
        raise HTTPException(404, 'Ban not found')
    
    await collection.delete_one({'id': ban_id})
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': None,
        'user_id': user['id'],
        'action': f'admin_unban_{ban_type}',
        'category': 'security',
        'details': f'Removed ban on {ban_type}: {ban.get("value", ban_id)}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {'message': 'Ban removed'}


@router.get("/fraud/flags/enhanced")
async def get_fraud_flags_enhanced(
    user: dict = Depends(require_super_admin),
    skip: int = 0,
    limit: int = 100,
    flag_type: Optional[str] = None,
    tenant_id: Optional[str] = None,
    date_from: Optional[str] = None
):
    """Enhanced fraud flags with filtering."""
    query = {}
    
    if flag_type:
        query['type'] = flag_type
    if tenant_id:
        query['tenant_id'] = tenant_id
    if date_from:
        query['created_at'] = {'$gte': date_from}
    
    flags = await db.fraud_flags.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.fraud_flags.count_documents(query)
    
    # Get flag types for filter
    flag_types = await db.fraud_flags.distinct('type')
    
    return {
        'flags': flags,
        'total': total,
        'flag_types': flag_types
    }


# ==================== TENANT IMPERSONATION ====================

@router.post("/tenants/{tenant_id}/impersonate")
async def impersonate_tenant(tenant_id: str, request: Request, user: dict = Depends(require_super_admin)):
    """Generate an impersonation token for a tenant owner."""
    tenant = await db.tenants.find_one({'id': tenant_id}, {'_id': 0})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    owner = await db.users.find_one({'id': tenant.get('owner_id')}, {'_id': 0})
    if not owner:
        raise HTTPException(404, 'Tenant owner not found')
    
    # Create impersonation token with special flag
    from auth import create_token
    token = create_token(owner['id'], owner['role'], tenant_id)
    
    # Log impersonation
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_impersonate_tenant',
        'category': 'security',
        'details': f'Admin {user["email"]} impersonated tenant {tenant["name"]}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {
        'token': token,
        'tenant': tenant,
        'owner': {
            'id': owner['id'],
            'email': owner['email'],
            'name': owner.get('name', '')
        }
    }
