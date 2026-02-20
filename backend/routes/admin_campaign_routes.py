"""
Admin Campaign Builder - Create and manage campaigns on behalf of tenants
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from database import db
from auth import require_super_admin
import uuid
from datetime import datetime, timezone
from typing import Optional, List
import re
import secrets
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/tenants", tags=["admin-campaigns"])


# ==================== PYDANTIC MODELS ====================

class PrizeCreate(BaseModel):
    label: str
    prize_type: str = "discount"  # discount, free_item, gift, points, consolation
    value: str = ""
    weight: int = 10  # probability weight
    stock_total: int = 100
    expiration_days: int = 30
    is_consolation: bool = False
    display_color: str = "#6366f1"


class CampaignCreate(BaseModel):
    # Step A - Basics
    title: str
    slug: Optional[str] = None
    timezone: str = "Europe/Paris"
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    status: str = "draft"  # draft, test, active, paused, ended
    
    # Step B - Player requirements
    require_email: bool = True
    require_phone: bool = False
    require_whatsapp: bool = False
    max_plays_per_email: int = 2
    max_plays_per_phone: int = 2
    require_social_follow: bool = False
    social_platforms_required: List[str] = Field(default_factory=list)
    consent_marketing_email: bool = True
    consent_marketing_sms: bool = False
    consent_marketing_whatsapp: bool = False
    
    # Step C - Prizes
    prizes: List[PrizeCreate] = Field(default_factory=list)
    
    # Step D - Legal & Display
    intro_text: str = ""
    cta_text: str = "Tourner la roue !"
    terms_text: str = ""
    offer_terms_text: str = ""
    show_google_review: bool = True


class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    timezone: Optional[str] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    status: Optional[str] = None
    require_email: Optional[bool] = None
    require_phone: Optional[bool] = None
    require_whatsapp: Optional[bool] = None
    max_plays_per_email: Optional[int] = None
    max_plays_per_phone: Optional[int] = None
    require_social_follow: Optional[bool] = None
    social_platforms_required: Optional[List[str]] = None
    consent_marketing_email: Optional[bool] = None
    consent_marketing_sms: Optional[bool] = None
    consent_marketing_whatsapp: Optional[bool] = None
    prizes: Optional[List[PrizeCreate]] = None
    intro_text: Optional[str] = None
    cta_text: Optional[str] = None
    terms_text: Optional[str] = None
    offer_terms_text: Optional[str] = None
    show_google_review: Optional[bool] = None


class StatusChange(BaseModel):
    status: str  # draft, test, active, paused, ended
    reason: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================

def create_campaign_slug(title: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    return slug


def generate_test_token() -> str:
    return secrets.token_urlsafe(32)


# ==================== API ENDPOINTS ====================

@router.get("/{tenant_id}/campaigns")
async def list_tenant_campaigns(
    tenant_id: str,
    user: dict = Depends(require_super_admin),
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """List all campaigns for a tenant."""
    tenant = await db.tenants.find_one({'id': tenant_id})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    query = {'tenant_id': tenant_id}
    if status:
        query['status'] = status
    
    campaigns = await db.campaigns.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.campaigns.count_documents(query)
    
    # Enrich with stats
    for c in campaigns:
        c['play_count'] = await db.plays.count_documents({'campaign_id': c['id'], 'is_test': {'$ne': True}})
        c['test_play_count'] = await db.plays.count_documents({'campaign_id': c['id'], 'is_test': True})
        c['prize_count'] = len(c.get('prizes', []))
        c['total_stock'] = sum(p.get('stock_total', 0) for p in c.get('prizes', []))
        c['stock_remaining'] = sum(p.get('stock_remaining', p.get('stock_total', 0)) for p in c.get('prizes', []))
        c['created_by_admin'] = c.get('created_by_admin', False)
    
    return {
        'campaigns': campaigns,
        'total': total,
        'tenant': {'id': tenant_id, 'name': tenant['name']}
    }


@router.post("/{tenant_id}/campaigns")
async def create_tenant_campaign(
    tenant_id: str,
    req: CampaignCreate,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Create a campaign for a tenant (Admin Campaign Builder)."""
    tenant = await db.tenants.find_one({'id': tenant_id})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    # Check plan limits
    plan = await db.plans.find_one({'id': tenant.get('plan', 'free')})
    if plan:
        limits = plan.get('limits', {})
        campaign_limit = limits.get('campaigns', 1)
        if campaign_limit != -1:
            current_count = await db.campaigns.count_documents({'tenant_id': tenant_id})
            if current_count >= campaign_limit:
                raise HTTPException(400, f'Campaign limit reached ({campaign_limit}). Upgrade plan to create more.')
    
    campaign_id = str(uuid.uuid4())
    slug = req.slug or create_campaign_slug(req.title)
    
    # Check slug uniqueness
    existing_slug = await db.campaigns.find_one({'slug': slug})
    if existing_slug:
        slug = f"{slug}-{str(uuid.uuid4())[:6]}"
    
    # Process prizes
    prizes = []
    for idx, p in enumerate(req.prizes):
        prizes.append({
            'id': str(uuid.uuid4()),
            'label': p.label,
            'prize_type': p.prize_type,
            'value': p.value,
            'weight': p.weight,
            'stock_total': p.stock_total,
            'stock_remaining': p.stock_total,
            'expiration_days': p.expiration_days,
            'is_consolation': p.is_consolation,
            'display_color': p.display_color,
            'position': idx
        })
    
    campaign = {
        'id': campaign_id,
        'tenant_id': tenant_id,
        'title': req.title,
        'slug': slug,
        'timezone': req.timezone,
        'starts_at': req.starts_at,
        'ends_at': req.ends_at,
        'status': 'draft',  # Always start as draft
        
        # Player requirements
        'require_email': req.require_email,
        'require_phone': req.require_phone,
        'require_whatsapp': req.require_whatsapp,
        'max_plays_per_email': req.max_plays_per_email,
        'max_plays_per_phone': req.max_plays_per_phone,
        'require_social_follow': req.require_social_follow,
        'social_platforms_required': req.social_platforms_required,
        'consent_marketing_email': req.consent_marketing_email,
        'consent_marketing_sms': req.consent_marketing_sms,
        'consent_marketing_whatsapp': req.consent_marketing_whatsapp,
        
        # Prizes
        'prizes': prizes,
        
        # Display
        'intro_text': req.intro_text,
        'cta_text': req.cta_text,
        'terms_text': req.terms_text,
        'offer_terms_text': req.offer_terms_text,
        'show_google_review': req.show_google_review,
        
        # Admin tracking
        'created_by_admin': True,
        'created_by_admin_id': user['id'],
        'test_token': generate_test_token(),
        
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.campaigns.insert_one(campaign)
    
    # Audit log
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_create_campaign',
        'category': 'campaign',
        'details': f'Admin created campaign: {req.title}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    campaign.pop('_id', None)
    return campaign


@router.get("/{tenant_id}/campaigns/{campaign_id}")
async def get_tenant_campaign(
    tenant_id: str,
    campaign_id: str,
    user: dict = Depends(require_super_admin)
):
    """Get a specific campaign details."""
    campaign = await db.campaigns.find_one({
        'id': campaign_id,
        'tenant_id': tenant_id
    }, {'_id': 0})
    
    if not campaign:
        raise HTTPException(404, 'Campaign not found')
    
    # Enrich with stats
    campaign['play_count'] = await db.plays.count_documents({'campaign_id': campaign_id, 'is_test': {'$ne': True}})
    campaign['test_play_count'] = await db.plays.count_documents({'campaign_id': campaign_id, 'is_test': True})
    campaign['player_count'] = await db.players.count_documents({'campaign_id': campaign_id})
    campaign['codes_issued'] = await db.reward_codes.count_documents({'campaign_id': campaign_id, 'is_test': {'$ne': True}})
    campaign['codes_redeemed'] = await db.reward_codes.count_documents({'campaign_id': campaign_id, 'status': 'redeemed'})
    
    return campaign


@router.patch("/{tenant_id}/campaigns/{campaign_id}")
async def update_tenant_campaign(
    tenant_id: str,
    campaign_id: str,
    req: CampaignUpdate,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Update a campaign."""
    campaign = await db.campaigns.find_one({
        'id': campaign_id,
        'tenant_id': tenant_id
    })
    
    if not campaign:
        raise HTTPException(404, 'Campaign not found')
    
    update_data = req.model_dump(exclude_none=True)
    
    # Handle prizes separately
    if 'prizes' in update_data:
        prizes = []
        for idx, p in enumerate(req.prizes):
            # Check if prize exists (keep stock_remaining)
            existing_prize = next((ep for ep in campaign.get('prizes', []) if ep.get('label') == p.label), None)
            stock_remaining = existing_prize.get('stock_remaining', p.stock_total) if existing_prize else p.stock_total
            
            prizes.append({
                'id': existing_prize.get('id', str(uuid.uuid4())) if existing_prize else str(uuid.uuid4()),
                'label': p.label,
                'prize_type': p.prize_type,
                'value': p.value,
                'weight': p.weight,
                'stock_total': p.stock_total,
                'stock_remaining': min(stock_remaining, p.stock_total),
                'expiration_days': p.expiration_days,
                'is_consolation': p.is_consolation,
                'display_color': p.display_color,
                'position': idx
            })
        update_data['prizes'] = prizes
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.campaigns.update_one({'id': campaign_id}, {'$set': update_data})
    
    # Audit log
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_update_campaign',
        'category': 'campaign',
        'details': f'Admin updated campaign: {campaign.get("title", campaign_id)}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    updated = await db.campaigns.find_one({'id': campaign_id}, {'_id': 0})
    return updated


@router.post("/{tenant_id}/campaigns/{campaign_id}/status")
async def change_campaign_status(
    tenant_id: str,
    campaign_id: str,
    req: StatusChange,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Change campaign status (draft/test/active/paused/ended)."""
    campaign = await db.campaigns.find_one({
        'id': campaign_id,
        'tenant_id': tenant_id
    })
    
    if not campaign:
        raise HTTPException(404, 'Campaign not found')
    
    old_status = campaign.get('status', 'draft')
    new_status = req.status.lower()
    
    valid_statuses = ['draft', 'test', 'active', 'paused', 'ended']
    if new_status not in valid_statuses:
        raise HTTPException(400, f'Invalid status. Must be one of: {valid_statuses}')
    
    # Validation before going active
    if new_status == 'active':
        prizes = campaign.get('prizes', [])
        if not prizes:
            raise HTTPException(400, 'Cannot activate: No prizes configured')
        
        total_stock = sum(p.get('stock_remaining', 0) for p in prizes)
        if total_stock <= 0:
            raise HTTPException(400, 'Cannot activate: No stock available')
        
        if not campaign.get('terms_text'):
            raise HTTPException(400, 'Cannot activate: Terms text is required')
    
    update = {
        'status': new_status,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    if new_status == 'active' and old_status != 'active':
        update['activated_at'] = datetime.now(timezone.utc).isoformat()
        update['activated_by'] = user['id']
    
    if new_status == 'ended':
        update['ended_at'] = datetime.now(timezone.utc).isoformat()
        update['ended_by'] = user['id']
    
    await db.campaigns.update_one({'id': campaign_id}, {'$set': update})
    
    # Audit log
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_change_campaign_status',
        'category': 'campaign',
        'details': f'Status changed from {old_status} to {new_status}. Reason: {req.reason or "N/A"}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {
        'message': f'Status changed to {new_status}',
        'old_status': old_status,
        'new_status': new_status
    }


@router.post("/{tenant_id}/campaigns/{campaign_id}/duplicate")
async def duplicate_campaign(
    tenant_id: str,
    campaign_id: str,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Duplicate a campaign."""
    campaign = await db.campaigns.find_one({
        'id': campaign_id,
        'tenant_id': tenant_id
    }, {'_id': 0})
    
    if not campaign:
        raise HTTPException(404, 'Campaign not found')
    
    new_id = str(uuid.uuid4())
    new_slug = f"{campaign['slug']}-copy-{str(uuid.uuid4())[:6]}"
    
    # Reset stats and status
    new_campaign = {
        **campaign,
        'id': new_id,
        'slug': new_slug,
        'title': f"{campaign['title']} (Copy)",
        'status': 'draft',
        'test_token': generate_test_token(),
        'created_by_admin': True,
        'created_by_admin_id': user['id'],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Reset prize stock
    for prize in new_campaign.get('prizes', []):
        prize['id'] = str(uuid.uuid4())
        prize['stock_remaining'] = prize['stock_total']
    
    # Remove activation/end timestamps
    new_campaign.pop('activated_at', None)
    new_campaign.pop('activated_by', None)
    new_campaign.pop('ended_at', None)
    new_campaign.pop('ended_by', None)
    
    await db.campaigns.insert_one(new_campaign)
    
    # Audit log
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_duplicate_campaign',
        'category': 'campaign',
        'details': f'Duplicated campaign: {campaign["title"]} -> {new_campaign["title"]}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    new_campaign.pop('_id', None)
    return new_campaign


@router.post("/{tenant_id}/campaigns/{campaign_id}/test-link")
async def generate_test_link(
    tenant_id: str,
    campaign_id: str,
    user: dict = Depends(require_super_admin)
):
    """Generate a test link for a campaign."""
    campaign = await db.campaigns.find_one({
        'id': campaign_id,
        'tenant_id': tenant_id
    })
    
    if not campaign:
        raise HTTPException(404, 'Campaign not found')
    
    # Generate new test token
    test_token = generate_test_token()
    
    await db.campaigns.update_one(
        {'id': campaign_id},
        {'$set': {'test_token': test_token, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    import os
    base_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://gamif-admin-hub.preview.emergentagent.com')
    test_url = f"{base_url}/play/{campaign['slug']}?mode=test&token={test_token}"
    
    return {
        'test_url': test_url,
        'test_token': test_token,
        'expires': 'Never (regenerate for new token)'
    }


@router.delete("/{tenant_id}/campaigns/{campaign_id}")
async def delete_campaign(
    tenant_id: str,
    campaign_id: str,
    request: Request,
    user: dict = Depends(require_super_admin)
):
    """Delete a campaign (soft delete by setting status to 'deleted')."""
    campaign = await db.campaigns.find_one({
        'id': campaign_id,
        'tenant_id': tenant_id
    })
    
    if not campaign:
        raise HTTPException(404, 'Campaign not found')
    
    if campaign.get('status') == 'active':
        raise HTTPException(400, 'Cannot delete an active campaign. Pause or end it first.')
    
    # Check if there are plays
    play_count = await db.plays.count_documents({'campaign_id': campaign_id, 'is_test': {'$ne': True}})
    
    if play_count > 0:
        # Soft delete
        await db.campaigns.update_one(
            {'id': campaign_id},
            {'$set': {'status': 'deleted', 'deleted_at': datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Hard delete if no plays
        await db.campaigns.delete_one({'id': campaign_id})
        await db.plays.delete_many({'campaign_id': campaign_id})  # Delete test plays
    
    # Audit log
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'user_id': user['id'],
        'action': 'admin_delete_campaign',
        'category': 'campaign',
        'details': f'Deleted campaign: {campaign.get("title", campaign_id)} (had {play_count} plays)',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {'message': 'Campaign deleted', 'had_plays': play_count > 0}
