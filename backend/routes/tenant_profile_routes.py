"""
Tenant Profile Routes - Business details, logo upload, social links
"""
from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from pydantic import BaseModel
from database import db
from auth import get_current_user, require_tenant_access
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict
import base64
import qrcode
import io
import os

router = APIRouter(prefix="/api/tenant", tags=["tenant-profile"])


class ProfileUpdate(BaseModel):
    manager_first_name: Optional[str] = None
    manager_last_name: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    registration_number: Optional[str] = None
    vat_number: Optional[str] = None
    google_review_url: Optional[str] = None
    social_links: Optional[Dict[str, str]] = None


class BrandingUpdate(BaseModel):
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None


@router.get("/profile")
async def get_tenant_profile(user: dict = Depends(require_tenant_access)):
    """Get the current tenant's business profile."""
    tenant = await db.tenants.find_one({'id': user['tenant_id']}, {'_id': 0})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    return {
        'profile': tenant.get('profile', {}),
        'branding': tenant.get('branding', {}),
        'name': tenant.get('name', ''),
        'slug': tenant.get('slug', ''),
        'plan': tenant.get('plan', 'free')
    }


@router.put("/profile")
async def update_tenant_profile(
    req: ProfileUpdate,
    request: Request,
    user: dict = Depends(require_tenant_access)
):
    """Update the tenant's business profile."""
    tenant = await db.tenants.find_one({'id': user['tenant_id']})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    profile = tenant.get('profile', {})
    
    # Update only provided fields
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        profile[key] = value
    
    # If company name changed, update tenant name too
    if req.company_name:
        await db.tenants.update_one(
            {'id': user['tenant_id']},
            {'$set': {
                'name': req.company_name,
                'profile': profile,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        await db.tenants.update_one(
            {'id': user['tenant_id']},
            {'$set': {
                'profile': profile,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }}
        )
    
    await db.audit_logs.insert_one({
        'id': str(uuid.uuid4()),
        'tenant_id': user['tenant_id'],
        'user_id': user['id'],
        'action': 'update_profile',
        'category': 'profile',
        'details': 'Business profile updated',
        'ip_address': request.client.host if request.client else 'unknown',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {'message': 'Profile updated', 'profile': profile}


@router.put("/branding")
async def update_tenant_branding(
    req: BrandingUpdate,
    user: dict = Depends(require_tenant_access)
):
    """Update the tenant's branding colors."""
    tenant = await db.tenants.find_one({'id': user['tenant_id']})
    if not tenant:
        raise HTTPException(404, 'Tenant not found')
    
    branding = tenant.get('branding', {})
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        branding[key] = value
    
    await db.tenants.update_one(
        {'id': user['tenant_id']},
        {'$set': {'branding': branding, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    return {'message': 'Branding updated', 'branding': branding}


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    user: dict = Depends(require_tenant_access)
):
    """Upload tenant logo (stored as base64 for simplicity)."""
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, 'File must be an image')
    
    # Read and encode
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:  # 2MB limit
        raise HTTPException(400, 'File too large (max 2MB)')
    
    base64_image = f"data:{file.content_type};base64,{base64.b64encode(content).decode()}"
    
    await db.tenants.update_one(
        {'id': user['tenant_id']},
        {'$set': {
            'profile.logo_url': base64_image,
            'branding.logo_url': base64_image,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {'message': 'Logo uploaded', 'logo_url': base64_image}


# NOTE: /players endpoint moved to tenant_analytics_routes.py with enhanced filters and stats


@router.get("/campaigns/{campaign_id}/qrcode")
async def get_campaign_qrcode(
    campaign_id: str,
    user: dict = Depends(require_tenant_access)
):
    """Generate QR code for a campaign."""
    campaign = await db.campaigns.find_one({
        'id': campaign_id,
        'tenant_id': user['tenant_id']
    })
    if not campaign:
        raise HTTPException(404, 'Campaign not found')
    
    tenant = await db.tenants.find_one({'id': user['tenant_id']})
    
    # Build the game URL
    base_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://wheel-fortune-12.preview.emergentagent.com')
    game_url = f"{base_url}/play/{campaign['slug']}"
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(game_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    qr_base64 = f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
    
    return {
        'qr_code': qr_base64,
        'game_url': game_url,
        'campaign_name': campaign.get('title', ''),
        'campaign_slug': campaign['slug']
    }


@router.get("/admin-messages")
async def get_admin_messages_for_tenant(user: dict = Depends(require_tenant_access)):
    """Get admin messages for this tenant (broadcast + targeted)."""
    tenant_id = user['tenant_id']
    now = datetime.now(timezone.utc).isoformat()
    
    # Get broadcast messages + messages targeted to this tenant
    messages = await db.admin_messages.find({
        '$or': [
            {'target_type': 'broadcast'},
            {'target_type': 'targeted', 'target_tenant_ids': tenant_id}
        ],
        '$or': [
            {'expires_at': None},
            {'expires_at': {'$gt': now}}
        ]
    }, {'_id': 0}).sort('created_at', -1).to_list(50)
    
    # Mark which ones are read
    for m in messages:
        read = await db.tenant_message_reads.find_one({
            'tenant_id': tenant_id,
            'message_id': m['id']
        })
        m['is_read'] = read is not None
    
    return {'messages': messages}


@router.post("/admin-messages/{message_id}/read")
async def mark_message_read(message_id: str, user: dict = Depends(require_tenant_access)):
    """Mark an admin message as read."""
    existing = await db.tenant_message_reads.find_one({
        'tenant_id': user['tenant_id'],
        'message_id': message_id
    })
    
    if not existing:
        await db.tenant_message_reads.insert_one({
            'tenant_id': user['tenant_id'],
            'message_id': message_id,
            'read_at': datetime.now(timezone.utc).isoformat()
        })
    
    return {'message': 'Marked as read'}
