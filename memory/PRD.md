# PrizeWheel Pro - Multi-Tenant Gamification SaaS PRD

## Original Problem Statement
Build a production-ready multi-tenant SaaS gamification platform allowing businesses (restaurants, bars, hotels, retail, events) to create promotional games (wheel of fortune) to collect leads and distribute rewards.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) with modular router architecture
- **Database**: MongoDB (single DB, tenant_id isolation)
- **Payments**: Stripe (test mode) via emergentintegrations
- **Auth**: JWT with bcrypt password hashing
- **i18n**: Hardcoded JSON (EN/FR)
- **Encryption**: Fernet symmetric encryption for sensitive data (Stripe keys)
- **QR Codes**: qrcode library for game URL generation

## User Personas
1. **Super Admin**: Full system access, manage tenants/plans/billing/messaging/fraud/campaigns
2. **Tenant Owner**: Business owner managing campaigns, prizes, staff, billing, company profile
3. **Tenant Staff**: Code redemption only
4. **Player**: Public user playing promotional games

## Core Requirements (Static)
- Multi-tenant architecture with strict tenant_id filtering
- RBAC: super_admin, tenant_owner, tenant_staff, player
- Deterministic server-side game engine (weighted random draw)
- Campaign lifecycle: Draft -> Test -> Active -> Paused -> Ended
- Fraud protection: max 2 plays per email_hash/phone_hash per campaign + IP/device/identity banning
- Consent registry: type, timestamp, IP, legal text version
- Cookie compliance: Accept/Reject/Manage with category-based consent
- Stripe subscription billing (Free/Pro/Business plans)
- Multi-language (EN/FR) with browser detection + manual toggle
- Audit logging for all sensitive actions

## What's Been Implemented

### Phase 1 - Core MVP (Feb 17, 2026)
- [x] JWT auth with email verification and password reset
- [x] Multi-tenant data isolation (tenant_id on all queries)
- [x] Campaign CRUD with status workflow
- [x] Prize management with weighted draw engine
- [x] Server-side deterministic game engine
- [x] Fraud protection (max 2 plays per email/phone hash)
- [x] Staff code redemption
- [x] Stripe checkout integration
- [x] Consent registry (game terms + cookies)
- [x] Audit logging

### Phase 2 - Super Admin Panel (Feb 17, 2026)
- [x] Plans CRUD API with limits
- [x] Stripe Configuration with encrypted keys
- [x] Enhanced Tenant Management with filters
- [x] Tenant Detail API with stats
- [x] Admin Messaging (broadcast + targeted)
- [x] Enhanced Audit Logs with category/action filtering
- [x] Fraud Center with ban management (IP, device, identity)
- [x] Server-side Ban Enforcement
- [x] Consent-gated Exports (CSV with PII masking)
- [x] Tenant Notes and Impersonation
- [x] Plan Change Override

### Phase 3 - Enhanced Features (Feb 20, 2026) ✅ COMPLETED
- [x] **Simplified Signup Flow**: 2-step registration (Step 1: name, company, phone / Step 2: email, password, GDPR)
- [x] **Plan Selection Popup**: Appears after signup with Free/Pro/Business options
- [x] **Complete Tenant Profile (Mon Entreprise)**: 
  - Informations tab: Manager name, Company, Address, Phone, Email, SIRET, TVA, Google Review URL
  - Réseaux Sociaux tab: Add/remove social media links
  - Apparence tab: Logo upload, Primary/Secondary colors
- [x] **Admin Campaign Builder (Done-for-You)**:
  - 4-step wizard: Basics, Player Requirements, Prizes, Legal & Display
  - Status management: draft -> test -> active -> paused -> ended
  - Test link generation with token
  - Campaign duplication and deletion
  - Audit logging for all admin actions
- [x] **QR Code Generation**: Base64 PNG with game URL for each campaign

## Credentials
- Super Admin: admin@prizewheelpro.com / Admin123!
- Test Tenant: test@example.com / Test123!
- Active Campaign: /play/summer-spin

## Plan Limits
- **Free**: 1 campaign, 500 plays/month, 0 staff, no export
- **Pro**: Unlimited campaigns, 10,000 plays/month, 5 staff, export, branding removal
- **Business**: Everything unlimited, API access, white label, multi-location

## Prioritized Backlog

### P0 (Critical for Production)
- [ ] Real email sending for verification/reset (SendGrid/Resend)
- [ ] Stripe live mode configuration
- [ ] 2FA for Super Admin
- [ ] HTTPS enforcement

### P1 (Important Features) - USER REQUESTED
- [ ] **Game Wheel Redesign**: "Perfect and pro, worthy of 2026" with beautiful animations
- [ ] **Enhanced Player Flow**: 
  - Mandatory GDPR consent before play
  - Optional pre-play tasks (follow social media)
  - Copy code button for winners
  - Optional Google Review link after game
- [ ] **Tenant Player List**: View player contact info for remarketing

### P2 (Nice to Have) - USER REQUESTED
- [ ] **Legal Pages**: Mentions légales, Cookies, Politique de confidentialité, CGV
- [ ] Enhanced Invoicing with company details

### P3 (Future)
- [ ] Advanced analytics with charts
- [ ] Multi-location support
- [ ] Webhook integration
- [ ] Custom domain support
- [ ] Async export jobs
- [ ] OTP verification

## Database Collections

### Core
- `users`: id, email, password_hash, role, tenant_id, first_name, last_name, phone
- `tenants`: id, name, slug, owner_id, status, plan, profile (business details), branding
- `campaigns`: id, tenant_id, title, slug, status, prizes[], settings, created_by_admin
- `plays`: id, campaign_id, tenant_id, player_id, prize_id, is_test
- `players`: id, campaign_id, tenant_id, email, phone, email_hash, phone_hash
- `reward_codes`: id, campaign_id, tenant_id, code, status, expires_at
- `consents`: id, player_id, consent_type, ip_address, legal_text_version

### Admin
- `plans`: id, name, price_monthly, price_yearly, limits, features, is_active
- `platform_settings`: setting_type, mode, encrypted keys
- `admin_messages`: id, title, content, message_type, target_type
- `tenant_notes`: id, tenant_id, content, created_by
- `banned_ips`, `banned_devices`, `blacklisted_identities`
- `audit_logs`: id, tenant_id, user_id, action, category, details

## Key API Endpoints

### Auth
- `POST /api/auth/signup` - Simplified tenant/user creation with profile
- `POST /api/auth/login` - Authenticate
- `GET /api/auth/me` - Current user

### Tenant Profile
- `GET /api/tenant/profile` - Get company profile and branding
- `PUT /api/tenant/profile` - Update business details and social links
- `PUT /api/tenant/branding` - Update colors
- `POST /api/tenant/logo` - Upload logo
- `GET /api/tenant/campaigns/:id/qrcode` - Generate QR code

### Admin Campaigns
- `GET /api/admin/tenants/:id/campaigns` - List campaigns
- `POST /api/admin/tenants/:id/campaigns` - Create (Done-for-You)
- `PATCH /api/admin/tenants/:id/campaigns/:cid` - Update
- `POST /api/admin/tenants/:id/campaigns/:cid/status` - Change status
- `POST /api/admin/tenants/:id/campaigns/:cid/test-link` - Generate test URL
- `POST /api/admin/tenants/:id/campaigns/:cid/duplicate` - Copy
- `DELETE /api/admin/tenants/:id/campaigns/:cid` - Delete

## Testing
- Test reports: `/app/test_reports/iteration_3.json`
- Backend: 85% passing
- Frontend: 100% UI flows working
- All Phase 3 features verified working

## File Structure
```
/app/
├── backend/
│   ├── routes/
│   │   ├── auth_routes.py        # Simplified signup
│   │   ├── tenant_profile_routes.py  # Mon Entreprise + QR
│   │   ├── admin_campaign_routes.py  # Done-for-You builder
│   │   ├── admin_routes.py
│   │   ├── admin_extended_routes.py
│   │   ├── tenant_routes.py
│   │   ├── game_routes.py
│   │   └── billing_routes.py
│   ├── server.py
│   ├── database.py
│   └── auth.py
└── frontend/
    └── src/
        ├── pages/
        │   ├── Signup.js             # 2-step + plan popup
        │   ├── TenantProfile.js      # Mon Entreprise (3 tabs)
        │   ├── AdminCampaignBuilder.js  # 4-step wizard
        │   ├── TenantDashboard.js
        │   └── TenantDetail.js
        └── components/
            └── Sidebar.js
```
