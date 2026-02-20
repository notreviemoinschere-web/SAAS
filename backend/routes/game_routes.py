from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import db
from auth import hash_identifier
from game_engine import weighted_draw, generate_reward_code, calculate_prize_index
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
import hashlib

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/game", tags=["game"])

MAX_PLAYS_PER_IDENTIFIER = 2


class PlayRequest(BaseModel):
    email: str
    phone: Optional[str] = None
    first_name: Optional[str] = None
    consent_accepted: bool = True
    marketing_consent: bool = False
    device_hash: Optional[str] = None
    lang: Optional[str] = "en"
    tasks_completed: Optional[dict] = None


class ConsentRecord(BaseModel):
    campaign_id: str
    consent_type: str
    legal_text_version: Optional[str] = "1.0"


@router.get("/{slug}")
async def get_campaign_for_play(slug: str, lang: str = "en"):
    # Find campaign by slug across all tenants (public endpoint)
    campaign = await db.campaigns.find_one(
        {'slug': slug, 'status': {'$in': ['active', 'test']}},
        {'_id': 0}
    )
    if not campaign:
        raise HTTPException(404, 'Campaign not found or not active')

    tenant = await db.tenants.find_one({'id': campaign['tenant_id']}, {'_id': 0})
    
    # Get tenant profile for social links and branding
    tenant_profile = await db.tenant_profiles.find_one({'tenant_id': campaign['tenant_id']}, {'_id': 0})

    prizes = await db.prizes.find(
        {'campaign_id': campaign['id']},
        {'_id': 0, 'stock_remaining': 0, 'weight': 0}
    ).to_list(100)

    # Localize
    title = campaign.get(f'title_{lang}') or campaign.get('title_fr') if lang == 'fr' else campaign.get('title')
    if not title:
        title = campaign.get('title', '')

    description = campaign.get(f'description_{lang}') or campaign.get('description_fr') if lang == 'fr' else campaign.get('description')
    if not description:
        description = campaign.get('description', '')

    for p in prizes:
        if lang == 'fr' and p.get('label_fr'):
            p['label'] = p['label_fr']

    # Build tenant profile response
    profile_data = {}
    if tenant_profile:
        profile_data = {
            'social_links': tenant_profile.get('social_links', {}),
            'primary_color': tenant_profile.get('branding', {}).get('primary_color', '#6366f1'),
            'secondary_color': tenant_profile.get('branding', {}).get('secondary_color', '#8b5cf6'),
            'logo_url': tenant_profile.get('branding', {}).get('logo_url'),
            'google_review_url': tenant_profile.get('google_review_url')
        }

    return {
        'campaign': {
            'id': campaign['id'],
            'title': title,
            'description': description,
            'slug': campaign['slug'],
            'status': campaign['status'],
            'legal_text': campaign.get(f'legal_text_{lang}') or campaign.get('legal_text', ''),
            'terms_text': campaign.get('terms_text', ''),
            'rules': campaign.get(f'rules_{lang}') or campaign.get('rules', ''),
            'intro_text': campaign.get('intro_text', ''),
            'cta_text': campaign.get('cta_text', ''),
            'require_phone': campaign.get('require_phone', False),
            'require_social_follow': campaign.get('require_social_follow', False),
            'consent_marketing_email': campaign.get('consent_marketing_email', False),
            'show_google_review': campaign.get('show_google_review', False),
            'start_date': campaign.get('start_date'),
            'end_date': campaign.get('end_date')
        },
        'prizes': prizes,
        'tenant': {
            'name': tenant.get('name', '') if tenant else '',
            'branding': tenant.get('branding', {}) if tenant else {}
        },
        'tenant_profile': profile_data
    }


@router.post("/{slug}/play")
async def play_game(slug: str, req: PlayRequest, request: Request):
    campaign = await db.campaigns.find_one(
        {'slug': slug, 'status': {'$in': ['active', 'test']}},
        {'_id': 0}
    )
    if not campaign:
        raise HTTPException(404, 'Campaign not found or not active')

    tenant_id = campaign['tenant_id']
    campaign_id = campaign['id']
    is_test = campaign['status'] == 'test'
    
    # Get IP address
    ip_address = request.client.host if request.client else 'unknown'
    
    # SERVER-SIDE BAN ENFORCEMENT (non-test only)
    if not is_test:
        # Check IP ban
        banned_ip = await db.banned_ips.find_one({'value': ip_address})
        if banned_ip:
            # Check if ban has expired
            if banned_ip.get('expires_at'):
                if datetime.fromisoformat(banned_ip['expires_at']) > datetime.now(timezone.utc):
                    raise HTTPException(403, 'Access denied')
            else:
                raise HTTPException(403, 'Access denied')
        
        # Check device ban
        if req.device_hash:
            banned_device = await db.banned_devices.find_one({'value': req.device_hash})
            if banned_device:
                if banned_device.get('expires_at'):
                    if datetime.fromisoformat(banned_device['expires_at']) > datetime.now(timezone.utc):
                        raise HTTPException(403, 'Access denied from this device')
                else:
                    raise HTTPException(403, 'Access denied from this device')
        
        # Check email/phone hash blacklist
        email_hash_check = hash_identifier(req.email)
        blacklisted = await db.blacklisted_identities.find_one({'value': email_hash_check})
        if blacklisted:
            raise HTTPException(403, 'Access denied')

    # Check plan play limits for non-test plays
    if not is_test:
        tenant = await db.tenants.find_one({'id': tenant_id}, {'_id': 0})
        plan = tenant.get('plan', 'free') if tenant else 'free'
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()
        monthly_plays = await db.plays.count_documents({
            'tenant_id': tenant_id,
            'is_test': False,
            'created_at': {'$gte': month_start}
        })
        limits = {'free': 500, 'pro': 10000, 'business': 999999}
        if monthly_plays >= limits.get(plan, 500):
            raise HTTPException(429, 'Monthly play limit reached for current plan')

    if not req.consent_accepted:
        raise HTTPException(400, 'You must accept terms to play')

    email_hash = hash_identifier(req.email)
    phone_hash = hash_identifier(req.phone) if req.phone else None

    # Fraud check: max plays per identifier per campaign
    if not is_test:
        email_plays = await db.plays.count_documents({
            'campaign_id': campaign_id,
            'email_hash': email_hash,
            'is_test': False
        })
        if email_plays >= MAX_PLAYS_PER_IDENTIFIER:
            raise HTTPException(429, 'Maximum plays reached for this email')

        if phone_hash:
            phone_plays = await db.plays.count_documents({
                'campaign_id': campaign_id,
                'phone_hash': phone_hash,
                'is_test': False
            })
            if phone_plays >= MAX_PLAYS_PER_IDENTIFIER:
                raise HTTPException(429, 'Maximum plays reached for this phone number')

    # IP rate limiting
    ip_address = request.client.host if request.client else 'unknown'
    if not is_test:
        recent_ip_plays = await db.plays.count_documents({
            'campaign_id': campaign_id,
            'ip_address': ip_address,
            'is_test': False,
            'created_at': {'$gte': (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}
        })
        if recent_ip_plays >= 10:
            await db.fraud_flags.insert_one({
                'id': str(uuid.uuid4()),
                'tenant_id': tenant_id,
                'campaign_id': campaign_id,
                'type': 'ip_rate_limit',
                'details': f'IP {ip_address} exceeded rate limit',
                'ip_address': ip_address,
                'created_at': datetime.now(timezone.utc).isoformat()
            })
            raise HTTPException(429, 'Too many plays from this location')

    # Get or create player
    player = await db.players.find_one({
        'campaign_id': campaign_id,
        'email_hash': email_hash
    }, {'_id': 0})

    if not player:
        player = {
            'id': str(uuid.uuid4()),
            'campaign_id': campaign_id,
            'tenant_id': tenant_id,
            'email': req.email,
            'email_hash': email_hash,
            'phone': req.phone,
            'phone_hash': phone_hash,
            'plays_count': 0,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.players.insert_one(player)

    # Record consent
    await db.consents.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'player_id': player['id'],
        'consent_type': 'game_terms',
        'ip_address': ip_address,
        'legal_text_version': '1.0',
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    # Server-side weighted draw
    prizes = await db.prizes.find({'campaign_id': campaign_id}, {'_id': 0}).to_list(100)
    all_prizes_for_index = await db.prizes.find({'campaign_id': campaign_id}, {'_id': 0}).to_list(100)

    winning_prize = weighted_draw(prizes)

    reward_code_str = None
    reward_data = None
    prize_index = -1

    if winning_prize:
        prize_index = calculate_prize_index(all_prizes_for_index, winning_prize['id'])
        reward_code_str = generate_reward_code(is_test)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

        reward = {
            'id': str(uuid.uuid4()),
            'campaign_id': campaign_id,
            'tenant_id': tenant_id,
            'prize_id': winning_prize['id'],
            'player_id': player['id'],
            'code': reward_code_str,
            'status': 'active',
            'expires_at': expires_at,
            'redeemed_at': None,
            'redeemed_by': None,
            'is_test': is_test,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.reward_codes.insert_one(reward)
        reward_data = {
            'code': reward_code_str,
            'expires_at': expires_at,
            'prize_label': winning_prize.get('label', ''),
            'prize_value': winning_prize.get('value', '')
        }

        # Decrement stock only for non-test plays
        if not is_test:
            await db.prizes.update_one(
                {'id': winning_prize['id'], 'stock_remaining': {'$gt': 0}},
                {'$inc': {'stock_remaining': -1}}
            )

    # Record play
    play = {
        'id': str(uuid.uuid4()),
        'play_id': str(uuid.uuid4()),
        'campaign_id': campaign_id,
        'tenant_id': tenant_id,
        'player_id': player['id'],
        'email': req.email,
        'phone': req.phone,
        'first_name': req.first_name,
        'prize_id': winning_prize['id'] if winning_prize else None,
        'prize_label': winning_prize.get('label', '') if winning_prize else None,
        'reward_code': reward_code_str,
        'reward_code_id': reward['id'] if winning_prize else None,
        'email_hash': email_hash,
        'phone_hash': phone_hash,
        'ip_address': ip_address,
        'device_hash': req.device_hash,
        'marketing_consent': req.marketing_consent,
        'tasks_completed': req.tasks_completed,
        'is_test': is_test,
        'played_at': datetime.now(timezone.utc),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.plays.insert_one(play)

    # Update player play count
    await db.players.update_one(
        {'id': player['id']},
        {'$inc': {'plays_count': 1}}
    )

    return {
        'won': winning_prize is not None,
        'prize_index': prize_index,
        'reward': reward_data,
        'is_test': is_test
    }


@router.post("/consent")
async def record_consent(req: ConsentRecord, request: Request):
    consent = {
        'id': str(uuid.uuid4()),
        'campaign_id': req.campaign_id,
        'consent_type': req.consent_type,
        'ip_address': request.client.host if request.client else 'unknown',
        'legal_text_version': req.legal_text_version,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.consents.insert_one(consent)
    return {'message': 'Consent recorded'}
