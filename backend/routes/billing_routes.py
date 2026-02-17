from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from database import db
from auth import require_tenant_owner, get_current_user
import uuid
import os
from datetime import datetime, timezone
from typing import Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/billing", tags=["billing"])

PLANS = {
    'free': {'name': 'Free', 'price_monthly': 0.0, 'price_yearly': 0.0},
    'pro': {'name': 'Pro', 'price_monthly': 29.0, 'price_yearly': 278.0},
    'business': {'name': 'Business', 'price_monthly': 99.0, 'price_yearly': 950.0}
}


class CheckoutRequest(BaseModel):
    plan: str
    billing_cycle: str = "monthly"
    origin_url: str


@router.get("/plans")
async def list_plans():
    return {'plans': PLANS}


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, user: dict = Depends(require_tenant_owner)):
    if req.plan not in PLANS or req.plan == 'free':
        raise HTTPException(400, 'Invalid plan')

    plan_info = PLANS[req.plan]
    amount = plan_info['price_monthly'] if req.billing_cycle == 'monthly' else plan_info['price_yearly']

    stripe_key = os.environ.get('STRIPE_API_KEY')
    if not stripe_key:
        raise HTTPException(500, 'Stripe not configured')

    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest
    )

    success_url = f"{req.origin_url}/dashboard/billing?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{req.origin_url}/dashboard/billing"

    webhook_url = f"{req.origin_url}/api/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)

    checkout_req = CheckoutSessionRequest(
        amount=float(amount),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            'tenant_id': user['tenant_id'],
            'user_id': user['id'],
            'plan': req.plan,
            'billing_cycle': req.billing_cycle
        }
    )

    session = await stripe_checkout.create_checkout_session(checkout_req)

    # Create payment transaction record
    await db.payment_transactions.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': user['tenant_id'],
        'user_id': user['id'],
        'amount': amount,
        'currency': 'usd',
        'plan': req.plan,
        'billing_cycle': req.billing_cycle,
        'session_id': session.session_id,
        'payment_status': 'initiated',
        'metadata': {
            'plan': req.plan,
            'billing_cycle': req.billing_cycle
        },
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    return {'url': session.url, 'session_id': session.session_id}


@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, user: dict = Depends(require_tenant_owner)):
    stripe_key = os.environ.get('STRIPE_API_KEY')
    if not stripe_key:
        raise HTTPException(500, 'Stripe not configured')

    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url="")

    status = await stripe_checkout.get_checkout_status(session_id)

    # Update transaction
    tx = await db.payment_transactions.find_one({'session_id': session_id}, {'_id': 0})
    if tx and tx.get('payment_status') != 'paid':
        new_status = 'paid' if status.payment_status == 'paid' else status.payment_status
        await db.payment_transactions.update_one(
            {'session_id': session_id},
            {'$set': {
                'payment_status': new_status,
                'status': status.status,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }}
        )

        # If paid, upgrade tenant plan
        if new_status == 'paid' and tx.get('tenant_id'):
            plan = tx.get('plan', 'free')
            await db.tenants.update_one(
                {'id': tx['tenant_id']},
                {'$set': {'plan': plan, 'updated_at': datetime.now(timezone.utc).isoformat()}}
            )
            await db.subscriptions.update_one(
                {'tenant_id': tx['tenant_id']},
                {'$set': {
                    'plan': plan,
                    'status': 'active',
                    'stripe_session_id': session_id,
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )

    return {
        'status': status.status,
        'payment_status': status.payment_status,
        'amount_total': status.amount_total,
        'currency': status.currency
    }


@router.get("/subscription")
async def get_subscription(user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    tenant = await db.tenants.find_one({'id': tid}, {'_id': 0})
    sub = await db.subscriptions.find_one({'tenant_id': tid}, {'_id': 0})
    return {
        'plan': tenant.get('plan', 'free') if tenant else 'free',
        'subscription': sub
    }


@router.get("/invoices")
async def list_invoices(user: dict = Depends(require_tenant_owner)):
    tid = user['tenant_id']
    invoices = await db.payment_transactions.find(
        {'tenant_id': tid, 'payment_status': 'paid'},
        {'_id': 0}
    ).sort('created_at', -1).to_list(50)
    return {'invoices': invoices}
