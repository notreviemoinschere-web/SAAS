from fastapi import APIRouter, HTTPException, Request, Depends, Query
from pydantic import BaseModel
from database import db
from auth import require_tenant_owner, require_tenant_access, hash_password, get_current_user
from game_engine import validate_campaign_for_publish
import uuid
import re
from datetime import datetime, timezone
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tenant", tags=["tenant"])


class CampaignCreate(BaseModel):
    title: str
    title_fr: Optional[str] = ""
    description: Optional[str] = ""
    description_fr: Optional[str] = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    legal_text: Optional[str] = ""
    legal_text_fr: Optional[str] = ""
    rules: Optional[str] = ""
    rules_fr: Optional[str] = ""


class CampaignStatusUpdate(BaseModel):
    status: str


class PrizeCreate(BaseModel):
    label: str
    label_fr: Optional[str] = ""
    weight: int = 1
    stock: int = 10
    prize_type: Optional[str] = "coupon"
    value: Optional[str] = ""
    color: Optional[str] = "#4F46E5"


class PrizeUpdate(BaseModel):
    label: Optional[str] = None
    label_fr: Optional[str] = None
    weight: Optional[int] = None
    stock: Optional[int] = None
    prize_type: Optional[str] = None
    value: Optional[str] = None
    color: Optional[str] = None


class StaffCreate(BaseModel):
    email: str
    name: str
    password: str


@router.get("/dashboard")
async def tenant_dashboard(user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    total_campaigns = await db.campaigns.count_documents({'tenant_id': tid})
    active_campaigns = await db.campaigns.count_documents({'tenant_id': tid, 'status': 'active'})
    total_plays = await db.plays.count_documents({'tenant_id': tid, 'is_test': {'$ne': True}})
    plays_today = await db.plays.count_documents({
        'tenant_id': tid,
        'is_test': {'$ne': True},
        'created_at': {'$regex': f'^{today}'}
    })
    total_players = await db.players.count_documents({'tenant_id': tid})
    rewards_issued = await db.reward_codes.count_documents({'tenant_id': tid})
    rewards_redeemed = await db.reward_codes.count_documents({'tenant_id': tid, 'status': 'redeemed'})

    conversion_rate = round((rewards_redeemed / rewards_issued * 100), 1) if rewards_issued > 0 else 0

    recent_plays = await db.plays.find(
        {'tenant_id': tid, 'is_test': {'$ne': True}}, {'_id': 0}
    ).sort('created_at', -1).to_list(10)

    return {
        'total_campaigns': total_campaigns,
        'active_campaigns': active_campaigns,
        'total_plays': total_plays,
        'plays_today': plays_today,
        'total_players': total_players,
        'rewards_issued': rewards_issued,
        'rewards_redeemed': rewards_redeemed,
        'conversion_rate': conversion_rate,
        'recent_plays': recent_plays
    }


@router.get("/campaigns")
async def list_campaigns(
    user: dict = Depends(require_tenant_owner),
    status: Optional[str] = None
):
    tid = user['tenant_id']
    query = {'tenant_id': tid}
    if status:
        query['status'] = status

    campaigns = await db.campaigns.find(query, {'_id': 0}).sort('created_at', -1).to_list(100)

    for c in campaigns:
        c['prize_count'] = await db.prizes.count_documents({'campaign_id': c['id']})
        c['play_count'] = await db.plays.count_documents({'campaign_id': c['id'], 'is_test': {'$ne': True}})

    return {'campaigns': campaigns}


@router.post("/campaigns")
async def create_campaign(req: CampaignCreate, request: Request, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']

    # Check plan limits
    tenant = await db.tenants.find_one({'id': tid}, {'_id': 0})
    if tenant and tenant.get('plan') == 'free':
        active_count = await db.campaigns.count_documents({'tenant_id': tid, 'status': {'$in': ['active', 'test']}})
        if active_count >= 1:
            raise HTTPException(400, 'Free plan allows only 1 active campaign')

    slug = re.sub(r'[^a-z0-9]+', '-', req.title.lower()).strip('-')
    existing = await db.campaigns.find_one({'slug': slug, 'tenant_id': tid})
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:6]}"

    campaign = {
        'id': str(uuid.uuid4()),
        'tenant_id': tid,
        'title': req.title,
        'title_fr': req.title_fr,
        'slug': slug,
        'description': req.description,
        'description_fr': req.description_fr,
        'status': 'draft',
        'start_date': req.start_date,
        'end_date': req.end_date,
        'legal_text': req.legal_text,
        'legal_text_fr': req.legal_text_fr,
        'rules': req.rules,
        'rules_fr': req.rules_fr,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    await db.campaigns.insert_one(campaign)

    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tid,
        'user_id': user['id'],
        'action': 'create_campaign',
        'details': f'Campaign "{req.title}" created',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    campaign.pop('_id', None)
    return campaign


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    campaign = await db.campaigns.find_one({'id': campaign_id, 'tenant_id': tid}, {'_id': 0})
    if not campaign:
        raise HTTPException(404, 'Campaign not found')

    prizes = await db.prizes.find({'campaign_id': campaign_id}, {'_id': 0}).to_list(100)
    campaign['prizes'] = prizes
    return campaign


@router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, req: CampaignCreate, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    campaign = await db.campaigns.find_one({'id': campaign_id, 'tenant_id': tid})
    if not campaign:
        raise HTTPException(404, 'Campaign not found')

    if campaign['status'] not in ('draft', 'paused'):
        raise HTTPException(400, 'Can only edit draft or paused campaigns')

    update = {k: v for k, v in req.model_dump().items() if v is not None}
    update['updated_at'] = datetime.now(timezone.utc).isoformat()

    await db.campaigns.update_one({'id': campaign_id}, {'$set': update})
    updated = await db.campaigns.find_one({'id': campaign_id}, {'_id': 0})
    return updated


@router.put("/campaigns/{campaign_id}/status")
async def update_campaign_status(
    campaign_id: str,
    req: CampaignStatusUpdate,
    request: Request,
    user: dict = Depends(require_tenant_owner)
):
    tid = user['tenant_id']
    campaign = await db.campaigns.find_one({'id': campaign_id, 'tenant_id': tid}, {'_id': 0})
    if not campaign:
        raise HTTPException(404, 'Campaign not found')

    valid_transitions = {
        'draft': ['test', 'active'],
        'test': ['active', 'draft'],
        'active': ['paused', 'ended'],
        'paused': ['active', 'ended'],
        'ended': []
    }

    current = campaign['status']
    target = req.status

    if target not in valid_transitions.get(current, []):
        raise HTTPException(400, f'Cannot transition from {current} to {target}')

    # Validate before publishing
    if target == 'active':
        prizes = await db.prizes.find({'campaign_id': campaign_id}, {'_id': 0}).to_list(100)
        errors = validate_campaign_for_publish(campaign, prizes)
        if errors:
            raise HTTPException(400, f'Validation errors: {", ".join(errors)}')

    await db.campaigns.update_one(
        {'id': campaign_id},
        {'$set': {'status': target, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )

    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tid,
        'user_id': user['id'],
        'action': 'campaign_status_change',
        'details': f'Campaign "{campaign["title"]}" status: {current} -> {target}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    return {'message': f'Campaign status changed to {target}', 'status': target}


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    campaign = await db.campaigns.find_one({'id': campaign_id, 'tenant_id': tid})
    if not campaign:
        raise HTTPException(404, 'Campaign not found')
    if campaign['status'] == 'active':
        raise HTTPException(400, 'Cannot delete active campaign. Pause or end it first.')
    await db.campaigns.delete_one({'id': campaign_id})
    await db.prizes.delete_many({'campaign_id': campaign_id})
    return {'message': 'Campaign deleted'}


# --- Prizes ---
@router.get("/campaigns/{campaign_id}/prizes")
async def list_prizes(campaign_id: str, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    campaign = await db.campaigns.find_one({'id': campaign_id, 'tenant_id': tid})
    if not campaign:
        raise HTTPException(404, 'Campaign not found')
    prizes = await db.prizes.find({'campaign_id': campaign_id}, {'_id': 0}).to_list(100)
    return {'prizes': prizes}


@router.post("/campaigns/{campaign_id}/prizes")
async def add_prize(campaign_id: str, req: PrizeCreate, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    campaign = await db.campaigns.find_one({'id': campaign_id, 'tenant_id': tid})
    if not campaign:
        raise HTTPException(404, 'Campaign not found')

    prize = {
        'id': str(uuid.uuid4()),
        'campaign_id': campaign_id,
        'tenant_id': tid,
        'label': req.label,
        'label_fr': req.label_fr,
        'weight': req.weight,
        'stock': req.stock,
        'stock_remaining': req.stock,
        'prize_type': req.prize_type,
        'value': req.value,
        'color': req.color,
        'created_at': datetime.now(timezone.utc).isoformat()
    }

    await db.prizes.insert_one(prize)
    prize.pop('_id', None)
    return prize


@router.put("/prizes/{prize_id}")
async def update_prize(prize_id: str, req: PrizeUpdate, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    prize = await db.prizes.find_one({'id': prize_id, 'tenant_id': tid})
    if not prize:
        raise HTTPException(404, 'Prize not found')

    update = {}
    for k, v in req.model_dump().items():
        if v is not None:
            update[k] = v
    if 'stock' in update:
        diff = update['stock'] - prize['stock']
        update['stock_remaining'] = max(0, prize['stock_remaining'] + diff)

    if update:
        await db.prizes.update_one({'id': prize_id}, {'$set': update})

    updated = await db.prizes.find_one({'id': prize_id}, {'_id': 0})
    return updated


@router.delete("/prizes/{prize_id}")
async def delete_prize(prize_id: str, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    prize = await db.prizes.find_one({'id': prize_id, 'tenant_id': tid})
    if not prize:
        raise HTTPException(404, 'Prize not found')
    await db.prizes.delete_one({'id': prize_id})
    return {'message': 'Prize deleted'}


# --- Players ---
@router.get("/players")
async def list_players(
    user: dict = Depends(require_tenant_owner),
    skip: int = 0,
    limit: int = 50,
    campaign_id: Optional[str] = None
):
    tid = user['tenant_id']
    query = {'tenant_id': tid}
    if campaign_id:
        query['campaign_id'] = campaign_id

    players = await db.players.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.players.count_documents(query)
    return {'players': players, 'total': total}


# --- Staff ---
@router.get("/staff")
async def list_staff(user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    staff = await db.users.find(
        {'tenant_id': tid, 'role': 'tenant_staff'},
        {'_id': 0, 'password_hash': 0, 'verification_token': 0, 'reset_token': 0}
    ).to_list(50)
    return {'staff': staff}


@router.post("/staff")
async def add_staff(req: StaffCreate, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']

    tenant = await db.tenants.find_one({'id': tid}, {'_id': 0})
    if tenant and tenant.get('plan') == 'free':
        raise HTTPException(400, 'Staff management requires Pro plan or higher')

    existing = await db.users.find_one({'email': req.email.lower()})
    if existing:
        raise HTTPException(400, 'Email already registered')

    staff_count = await db.users.count_documents({'tenant_id': tid, 'role': 'tenant_staff'})
    if tenant and tenant.get('plan') == 'pro' and staff_count >= 5:
        raise HTTPException(400, 'Pro plan allows up to 5 staff members')

    staff = {
        'id': str(uuid.uuid4()),
        'email': req.email.lower(),
        'password_hash': hash_password(req.password),
        'role': 'tenant_staff',
        'tenant_id': tid,
        'name': req.name,
        'email_verified': True,
        'verification_token': None,
        'reset_token': None,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(staff)
    return {'message': 'Staff member added', 'staff_id': staff['id']}


@router.delete("/staff/{staff_id}")
async def remove_staff(staff_id: str, user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    staff = await db.users.find_one({'id': staff_id, 'tenant_id': tid, 'role': 'tenant_staff'})
    if not staff:
        raise HTTPException(404, 'Staff member not found')
    await db.users.delete_one({'id': staff_id})
    return {'message': 'Staff member removed'}


# --- Reward Codes ---
@router.get("/rewards")
async def list_rewards(
    user: dict = Depends(require_tenant_access),
    skip: int = 0,
    limit: int = 50,
    campaign_id: Optional[str] = None,
    status: Optional[str] = None
):
    tid = user['tenant_id']
    query = {'tenant_id': tid}
    if campaign_id:
        query['campaign_id'] = campaign_id
    if status:
        query['status'] = status

    rewards = await db.reward_codes.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.reward_codes.count_documents(query)
    return {'rewards': rewards, 'total': total}


@router.post("/rewards/{code}/redeem")
async def redeem_reward(code: str, request: Request, user: dict = Depends(require_tenant_access)):
    tid = user['tenant_id']
    reward = await db.reward_codes.find_one({'code': code, 'tenant_id': tid}, {'_id': 0})

    if not reward:
        raise HTTPException(404, 'Reward code not found')
    if reward['status'] == 'redeemed':
        raise HTTPException(400, 'Code already redeemed')
    if reward['status'] == 'expired':
        raise HTTPException(400, 'Code has expired')
    if reward.get('code', '').startswith('TEST-'):
        raise HTTPException(400, 'Test codes cannot be redeemed')

    # Check expiry
    if reward.get('expires_at'):
        exp = datetime.fromisoformat(reward['expires_at'])
        if datetime.now(timezone.utc) > exp:
            await db.reward_codes.update_one({'code': code}, {'$set': {'status': 'expired'}})
            raise HTTPException(400, 'Code has expired')

    await db.reward_codes.update_one(
        {'code': code},
        {'$set': {
            'status': 'redeemed',
            'redeemed_at': datetime.now(timezone.utc).isoformat(),
            'redeemed_by': user['id']
        }}
    )

    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tid,
        'user_id': user['id'],
        'action': 'redeem_code',
        'details': f'Code {code} redeemed by {user["email"]}',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    return {'message': 'Code redeemed successfully', 'reward': reward}


@router.get("/rewards/{code}/verify")
async def verify_reward(code: str, user: dict = Depends(require_tenant_access)):
    tid = user['tenant_id']
    reward = await db.reward_codes.find_one({'code': code, 'tenant_id': tid}, {'_id': 0})
    if not reward:
        raise HTTPException(404, 'Reward code not found')

    # Get prize info
    prize = await db.prizes.find_one({'id': reward.get('prize_id')}, {'_id': 0})
    # Get player info
    player = await db.players.find_one({'id': reward.get('player_id')}, {'_id': 0})

    return {
        'reward': reward,
        'prize': prize,
        'player': player
    }
