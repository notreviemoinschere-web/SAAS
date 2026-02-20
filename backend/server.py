from fastapi import FastAPI, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import db, client
from auth import hash_password

# Import routers
from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router
from routes.admin_extended_routes import router as admin_extended_router
from routes.admin_campaign_routes import router as admin_campaign_router
from routes.tenant_routes import router as tenant_router
from routes.tenant_profile_routes import router as tenant_profile_router
from routes.tenant_analytics_routes import router as tenant_analytics_router
from routes.game_routes import router as game_router
from routes.billing_routes import router as billing_router

app = FastAPI(title="PrizeWheel Pro API")


def _build_cors_settings() -> dict:
    raw_origins = os.environ.get('CORS_ORIGINS', '*')
    origins = [o.strip() for o in raw_origins.split(',') if o.strip()]
    if not origins:
        origins = ['*']

    # Browsers reject Access-Control-Allow-Credentials with wildcard origin.
    # Keep credentials only when explicit origins are configured.
    allow_credentials = '*' not in origins

    return {
        'allow_origins': origins,
        'allow_credentials': allow_credentials
    }

# Include all routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(admin_extended_router)
app.include_router(admin_campaign_router)
app.include_router(tenant_router)
app.include_router(tenant_profile_router)
app.include_router(tenant_analytics_router)
app.include_router(game_router)
app.include_router(billing_router)

# CORS
cors_settings = _build_cors_settings()
app.add_middleware(
    CORSMiddleware,
    allow_credentials=cors_settings['allow_credentials'],
    allow_origins=cors_settings['allow_origins'],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    logger.info("Starting PrizeWheel Pro API...")

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tenants.create_index("id", unique=True)
    await db.tenants.create_index("slug", unique=True)
    await db.campaigns.create_index("id", unique=True)
    await db.campaigns.create_index([("slug", 1), ("tenant_id", 1)])
    await db.prizes.create_index("campaign_id")
    await db.plays.create_index([("campaign_id", 1), ("email_hash", 1)])
    await db.plays.create_index([("campaign_id", 1), ("phone_hash", 1)])
    await db.reward_codes.create_index("code", unique=True)
    await db.players.create_index([("campaign_id", 1), ("email_hash", 1)])
    await db.payment_transactions.create_index("session_id")
    
    # New indexes for admin features
    await db.plans.create_index("id", unique=True)
    await db.platform_settings.create_index("setting_type", unique=True)
    await db.admin_messages.create_index("id", unique=True)
    await db.admin_messages.create_index("created_at")
    await db.tenant_message_reads.create_index([("tenant_id", 1), ("message_id", 1)], unique=True)
    await db.tenant_notes.create_index([("tenant_id", 1), ("created_at", -1)])
    await db.banned_ips.create_index("value", unique=True)
    await db.banned_devices.create_index("value", unique=True)
    await db.blacklisted_identities.create_index("value", unique=True)
    await db.audit_logs.create_index([("tenant_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index("category")
    await db.consents.create_index([("player_id", 1), ("consent_type", 1)])

    # Seed super admin
    admin_email = os.environ.get('SUPER_ADMIN_EMAIL', 'admin@prizewheelpro.com')
    admin_password = os.environ.get('SUPER_ADMIN_PASSWORD', 'Admin123!')
    ensure_admin_password = os.environ.get('SUPER_ADMIN_ENSURE_PASSWORD', 'true').lower() == 'true'

    existing_admin = await db.users.find_one({'email': admin_email})
    if not existing_admin:
        admin = {
            'id': str(uuid.uuid4()),
            'email': admin_email,
            'password_hash': hash_password(admin_password),
            'role': 'super_admin',
            'tenant_id': None,
            'name': 'Super Admin',
            'email_verified': True,
            'verification_token': None,
            'reset_token': None,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)
        logger.info(f"Super admin created: {admin_email}")
    elif ensure_admin_password:
        await db.users.update_one(
            {'id': existing_admin['id']},
            {'$set': {
                'password_hash': hash_password(admin_password),
                'email_verified': True,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"Super admin password ensured for: {admin_email}")

    # Seed demo tenant account (useful for first deploy smoke tests)
    demo_tenant_email = os.environ.get('DEMO_TENANT_EMAIL', 'test@example.com').lower()
    demo_tenant_password = os.environ.get('DEMO_TENANT_PASSWORD', 'Test123!')
    demo_tenant_name = os.environ.get('DEMO_TENANT_NAME', 'Restaurant Test')

    demo_user = await db.users.find_one({'email': demo_tenant_email}, {'_id': 0})
    if not demo_user:
        demo_tenant_id = str(uuid.uuid4())
        demo_owner_id = str(uuid.uuid4())
        demo_slug = 'restaurant-test'
        if await db.tenants.find_one({'slug': demo_slug}, {'_id': 0}):
            demo_slug = f"restaurant-test-{str(uuid.uuid4())[:6]}"

        await db.tenants.insert_one({
            'id': demo_tenant_id,
            'name': demo_tenant_name,
            'slug': demo_slug,
            'owner_id': demo_owner_id,
            'status': 'active',
            'plan': 'free',
            'timezone': 'Europe/Paris',
            'default_language': 'fr',
            'branding': {},
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        })

        await db.users.insert_one({
            'id': demo_owner_id,
            'email': demo_tenant_email,
            'password_hash': hash_password(demo_tenant_password),
            'role': 'tenant_owner',
            'tenant_id': demo_tenant_id,
            'name': demo_tenant_name,
            'email_verified': True,
            'verification_token': None,
            'reset_token': None,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        })

        await db.subscriptions.insert_one({
            'id': str(uuid.uuid4()),
            'tenant_id': demo_tenant_id,
            'plan': 'free',
            'status': 'active',
            'created_at': datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Demo tenant owner created: {demo_tenant_email}")
    else:
        await db.users.update_one(
            {'id': demo_user['id']},
            {'$set': {
                'password_hash': hash_password(demo_tenant_password),
                'email_verified': True,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"Demo tenant owner password ensured: {demo_tenant_email}")

    # Seed plans
    plans = [
        {
            'id': 'free',
            'name': 'Free',
            'price_monthly': 0,
            'price_yearly': 0,
            'limits': {
                'campaigns': 1,
                'plays_per_month': 500,
                'staff': 0,
                'export': False,
                'branding_removable': False
            },
            'features': [],
            'is_active': True,
            'sort_order': 0
        },
        {
            'id': 'pro',
            'name': 'Pro',
            'price_monthly': 29,
            'price_yearly': 278,
            'limits': {
                'campaigns': -1,
                'plays_per_month': 10000,
                'staff': 5,
                'export': True,
                'branding_removable': True
            },
            'features': ['Unlimited campaigns', 'Export data', 'Remove branding'],
            'is_active': True,
            'sort_order': 1
        },
        {
            'id': 'business',
            'name': 'Business',
            'price_monthly': 99,
            'price_yearly': 950,
            'limits': {
                'campaigns': -1,
                'plays_per_month': -1,
                'staff': -1,
                'export': True,
                'branding_removable': True,
                'multi_location': True,
                'webhooks': True,
                'api_access': True,
                'white_label': True
            },
            'features': ['Everything in Pro', 'Unlimited plays', 'API access', 'White label'],
            'is_active': True,
            'sort_order': 2
        }
    ]

    for plan in plans:
        existing = await db.plans.find_one({'id': plan['id']})
        if not existing:
            await db.plans.insert_one(plan)
            logger.info(f"Plan seeded: {plan['name']}")

    logger.info("Startup complete.")


@app.get("/api")
async def root():
    return {"message": "PrizeWheel Pro API", "version": "1.0.0"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/translations/{lang}")
async def get_translations(lang: str):
    from i18n import TRANSLATIONS
    if lang not in TRANSLATIONS:
        lang = 'en'
    return TRANSLATIONS[lang]


# Stripe webhook endpoint (must be at app level, not router)
@app.post("/api/webhook/stripe")  # ✅ Fixed: was @api.post (NameError)
async def stripe_webhook(request: Request):
    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        return {"status": "ok"}  # Stripe not configured, ignore

    try:
        import stripe
        stripe.api_key = stripe_key

        body = await request.body()
        sig_header = request.headers.get("Stripe-Signature")
        webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

        if not webhook_secret or not sig_header:
            return {"status": "ignored"}

        event = stripe.Webhook.construct_event(
            payload=body,
            sig_header=sig_header,
            secret=webhook_secret,
        )

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            session_id = session.get("id")
            metadata = session.get("metadata", {})

            tenant_id = metadata.get("tenant_id")
            plan = metadata.get("plan", "free")

            if session_id:
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )

            if tenant_id:
                await db.tenants.update_one(
                    {"id": tenant_id},
                    {"$set": {
                        "plan": plan,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )

        return {"status": "success"}

    except Exception as e:
        logger.exception("Stripe webhook error")
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))

        
# Cookie consent endpoint
@app.post("/api/cookie-consent")
async def record_cookie_consent(request: Request):
    body = await request.json()
    consent = {
        'id': str(uuid.uuid4()),
        'consent_type': 'cookies',
        'categories': body.get('categories', {}),
        'ip_address': request.client.host if request.client else 'unknown',
        'user_agent': request.headers.get('user-agent', ''),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.consents.insert_one(consent)
    return {"status": "ok"}


@app.on_event("shutdown")
async def shutdown():
    client.close()
