from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import db
from auth import require_tenant_owner
import uuid
import os
from datetime import datetime, timezone
import logging
import stripe

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/billing", tags=["billing"])

PLANS = {
    "free": {"name": "Free", "price_monthly": 0.0, "price_yearly": 0.0},
    "pro": {"name": "Pro", "price_monthly": 29.0, "price_yearly": 278.0},
    "business": {"name": "Business", "price_monthly": 99.0, "price_yearly": 950.0},
}


class CheckoutRequest(BaseModel):
    plan: str
    billing_cycle: str = "monthly"  # monthly | yearly
    origin_url: str  # ex: https://ton-frontend.com


@router.get("/plans")
async def list_plans():
    return {"plans": PLANS}


def _get_stripe_key() -> str:
    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(500, "Stripe not configured (missing STRIPE_API_KEY)")
    return stripe_key


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, user: dict = Depends(require_tenant_owner)):
    if req.plan not in PLANS or req.plan == "free":
        raise HTTPException(400, "Invalid plan")

    if req.billing_cycle not in ("monthly", "yearly"):
        raise HTTPException(400, "Invalid billing_cycle")

    plan_info = PLANS[req.plan]
    amount = plan_info["price_monthly"] if req.billing_cycle == "monthly" else plan_info["price_yearly"]

    stripe.api_key = _get_stripe_key()

    # Stripe = montant en CENTIMES (int)
    amount_cents = int(round(float(amount) * 100))

    success_url = f"{req.origin_url}/dashboard/billing?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{req.origin_url}/dashboard/billing"

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"{plan_info['name']} ({req.billing_cycle})",
                        },
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "tenant_id": user["tenant_id"],
                "user_id": user["id"],
                "plan": req.plan,
                "billing_cycle": req.billing_cycle,
            },
        )
    except Exception as e:
        logger.exception("Stripe checkout session creation failed")
        raise HTTPException(500, f"Stripe error: {str(e)}")

    # Create payment transaction record
    await db.payment_transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "tenant_id": user["tenant_id"],
            "user_id": user["id"],
            "amount": float(amount),
            "currency": "usd",
            "plan": req.plan,
            "billing_cycle": req.billing_cycle,
            "session_id": session["id"],
            "payment_status": "initiated",
            "metadata": {"plan": req.plan, "billing_cycle": req.billing_cycle},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"url": session["url"], "session_id": session["id"]}


@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, user: dict = Depends(require_tenant_owner)):
    stripe.api_key = _get_stripe_key()

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as e:
        raise HTTPException(400, f"Invalid session_id or Stripe error: {str(e)}")

    # Stripe fields utiles
    status = session.get("status")  # open | complete | expired
    payment_status = session.get("payment_status")  # unpaid | paid | no_payment_required
    amount_total = session.get("amount_total")  # cents
    currency = session.get("currency")

    # Update transaction
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})

    if tx and tx.get("payment_status") != "paid":
        new_status = "paid" if payment_status == "paid" else payment_status

        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "payment_status": new_status,
                    "status": status,
                    "amount_total": (amount_total / 100) if amount_total is not None else None,
                    "currency": currency,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

        # If paid, upgrade tenant plan
        if new_status == "paid" and tx.get("tenant_id"):
            plan = tx.get("plan", "free")

            await db.tenants.update_one(
                {"id": tx["tenant_id"]},
                {"$set": {"plan": plan, "updated_at": datetime.now(timezone.utc).isoformat()}},
            )

            await db.subscriptions.update_one(
                {"tenant_id": tx["tenant_id"]},
                {
                    "$set": {
                        "plan": plan,
                        "status": "active",
                        "stripe_session_id": session_id,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
                upsert=True,
            )

    return {
        "status": status,
        "payment_status": payment_status,
        "amount_total": (amount_total / 100) if amount_total is not None else None,
        "currency": currency,
    }


@router.get("/subscription")
async def get_subscription(user: dict = Depends(require_tenant_owner)):
    tid = user["tenant_id"]
    tenant = await db.tenants.find_one({"id": tid}, {"_id": 0})
    sub = await db.subscriptions.find_one({"tenant_id": tid}, {"_id": 0})
    return {"plan": tenant.get("plan", "free") if tenant else "free", "subscription": sub}


@router.get("/invoices")
async def list_invoices(user: dict = Depends(require_tenant_owner)):
    tid = user["tenant_id"]
    invoices = (
        await db.payment_transactions.find({"tenant_id": tid, "payment_status": "paid"}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(50)
    )
    return {"invoices": invoices}
