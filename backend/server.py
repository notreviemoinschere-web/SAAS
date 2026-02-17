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
from routes.tenant_routes import router as tenant_router
from routes.game_routes import router as game_router
from routes.billing_routes import router as billing_router

app = FastAPI(title="PrizeWheel Pro API")

# Include all routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(admin_extended_router)
app.include_router(tenant_router)
app.include_router(game_router)
app.include_router(billing_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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

    # Seed super admin
    admin_email = os.environ.get('SUPER_ADMIN_EMAIL', 'admin@prizewheelpro.com')
    admin_password = os.environ.get('SUPER_ADMIN_PASSWORD', 'Admin123!')

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
            }
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
            }
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
            }
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
@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    stripe_signature = request.headers.get("Stripe-Signature")

    stripe_key = os.environ.get('STRIPE_API_KEY')
    if not stripe_key:
        return {"status": "ok"}

    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
        webhook_response = await stripe_checkout.handle_webhook(body, stripe_signature)

        if webhook_response and webhook_response.session_id:
            tx = await db.payment_transactions.find_one(
                {'session_id': webhook_response.session_id}, {'_id': 0}
            )
            if tx and tx.get('payment_status') != 'paid':
                new_status = webhook_response.payment_status or 'unknown'
                await db.payment_transactions.update_one(
                    {'session_id': webhook_response.session_id},
                    {'$set': {
                        'payment_status': new_status,
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }}
                )
                if new_status == 'paid' and tx.get('tenant_id'):
                    plan = tx.get('plan', 'free')
                    await db.tenants.update_one(
                        {'id': tx['tenant_id']},
                        {'$set': {'plan': plan, 'updated_at': datetime.now(timezone.utc).isoformat()}}
                    )
    except Exception as e:
        logger.error(f"Webhook error: {e}")

    return {"status": "ok"}


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
