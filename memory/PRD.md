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

## User Personas
1. **Super Admin**: Full system access, manage tenants/plans/billing/messaging/fraud
2. **Tenant Owner**: Business owner managing campaigns, prizes, staff, billing
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

## What's Been Implemented (Feb 17, 2026)

### Backend - Core
- [x] JWT auth with email verification and password reset
- [x] Multi-tenant data isolation (tenant_id on all queries)
- [x] Campaign CRUD with status workflow (Draft->Test->Active->Paused->Ended)
- [x] Prize management with weighted draw engine
- [x] Server-side deterministic game engine
- [x] Fraud protection (max 2 plays per email/phone hash)
- [x] IP rate limiting with fraud flag logging
- [x] Reward code generation (unique, with TEST- prefix for test mode)
- [x] Staff code redemption with verification
- [x] Stripe checkout integration (emergentintegrations)
- [x] Webhook handler for payment status sync
- [x] Consent registry (game terms + cookies)
- [x] Audit logging (signup, campaign changes, redemptions, admin actions)
- [x] Plan enforcement (campaign limits, play limits, staff limits)
- [x] Super admin seeding on startup
- [x] Database indexing for performance

### Backend - Super Admin Panel (NEW - Feb 17, 2026)
- [x] **Plans CRUD API**: Create, update, delete (soft), list subscription plans with limits
- [x] **Stripe Configuration**: Encrypted keys at rest (Fernet), test/live mode toggle
- [x] **Enhanced Tenant Management**: List with filters, detail view with stats
- [x] **Tenant Detail API**: Stats, campaigns, billing info, owner/staff, plan limits
- [x] **Admin Messaging**: Broadcast and targeted messages, type categorization
- [x] **Enhanced Audit Logs**: Category/action filtering, IP tracking
- [x] **Fraud Center**: Ban management (IP, device, identity hash)
- [x] **Server-side Ban Enforcement**: Game play endpoint checks all bans
- [x] **Consent-gated Exports**: CSV exports mask PII without marketing consent
- [x] **Tenant Notes**: Internal admin notes per tenant
- [x] **Tenant Impersonation**: Generate token to impersonate tenant owner
- [x] **Plan Change Override**: Admin can change tenant plans manually

### Frontend - Core
- [x] Landing page with hero, features, pricing
- [x] Auth flow: Login, Signup, Email Verification, Forgot/Reset Password
- [x] Tenant Dashboard (stats, campaigns, players, staff, rewards)
- [x] Campaign Editor (create/edit, prizes, status workflow)
- [x] Public Game Page (Wheel of Fortune with Canvas rendering)
- [x] Staff Redeem Interface (code verification + redemption)
- [x] Billing Page (plan comparison, Stripe checkout, invoice history)
- [x] Cookie Banner (Accept/Reject/Manage with category preferences)
- [x] Multi-language Toggle (EN/FR) on all pages
- [x] Responsive sidebar navigation (role-based)
- [x] Mobile-first player interface

### Frontend - Super Admin Panel (NEW - Feb 17, 2026)
- [x] **Overview Tab**: Stats cards, plan distribution breakdown
- [x] **Tenants Tab**: Advanced table with search/status/plan filters, suspend/activate
- [x] **Tenant Detail Page** (`/admin/tenants/:tenantId`):
  - Overview with stats cards and 7-day plays chart
  - Campaigns list
  - Billing section with plan change and cancel actions
  - Exports tab with consent-gated CSV downloads
  - Notes tab for internal admin notes
  - Impersonate and Suspend actions
- [x] **Plans & Stripe Tab**:
  - Stripe configuration with encrypted key display
  - Plans list with CRUD operations
- [x] **Messages Tab**: Create/delete admin messages (broadcast/targeted)
- [x] **Audit Logs Tab**: Enhanced logs with category/action filters
- [x] **Fraud Alerts Tab**: 
  - Fraud flags display
  - Active bans management (IP, device, identity)
  - Create new ban dialog

### Credentials
- Super Admin: admin@prizewheelpro.com / Admin123!
- Test Tenant: test@example.com / Test123!
- Active Campaign: /play/summer-spin

## Prioritized Backlog

### P0 (Critical for Production) - PARTIALLY DONE
- [x] Complete Super Admin panel (DONE)
- [x] Server-side plan gating (DONE)
- [x] Consent-gated data exports (DONE)
- [x] Fraud protection with bans (DONE)
- [ ] Real email sending for verification and password reset
- [ ] Stripe live mode configuration (UI ready, needs real keys)
- [ ] 2FA for Super Admin
- [ ] HTTPS enforcement

### P1 (Important Features)
- [ ] Advanced analytics with charts for tenants
- [ ] Multi-location support (Business plan)
- [ ] Webhook integration (player.created, play.completed, etc.)
- [ ] Custom domain support
- [ ] White-label branding

### P2 (Nice to Have)
- [ ] Async export jobs for large datasets
- [ ] Batch code upload
- [ ] OTP verification (Business plan)
- [ ] Data retention auto-purge (GDPR)
- [ ] DSAR handling (data export/deletion)
- [ ] Legal page management with versioning
- [ ] Notification system (low stock, campaign ending, payment failure)
- [ ] Daily database backups
- [ ] Status page

## Database Collections

### Core
- `users`: id, email, password_hash, role, tenant_id, email_verified
- `tenants`: id, name, slug, owner_id, status, plan, timezone, branding
- `campaigns`: id, tenant_id, title, slug, status, start_date, end_date
- `prizes`: id, campaign_id, tenant_id, label, weight, stock, stock_remaining
- `plays`: id, campaign_id, tenant_id, player_id, prize_id, email_hash, phone_hash
- `players`: id, campaign_id, tenant_id, email, email_hash, phone, phone_hash
- `reward_codes`: id, campaign_id, tenant_id, code, status, expires_at
- `consents`: id, player_id, consent_type, ip_address, legal_text_version
- `subscriptions`: id, tenant_id, plan, status, stripe_session_id
- `payment_transactions`: id, tenant_id, amount, plan, payment_status, session_id

### Admin (NEW)
- `plans`: id, name, price_monthly, price_yearly, limits, features, is_active, sort_order
- `platform_settings`: setting_type, mode, encrypted keys, publishable keys
- `admin_messages`: id, title, content, message_type, target_type, target_tenant_ids
- `tenant_message_reads`: tenant_id, message_id, read_at
- `tenant_notes`: id, tenant_id, content, created_by, created_at
- `banned_ips`: id, value, reason, expires_at, created_by
- `banned_devices`: id, value, reason, expires_at, created_by
- `blacklisted_identities`: id, value, reason, expires_at, created_by
- `audit_logs`: id, tenant_id, user_id, action, category, details, ip_address
- `fraud_flags`: id, tenant_id, campaign_id, type, details, ip_address

## API Endpoints

### Auth
- `POST /api/auth/signup` - Create tenant and user
- `POST /api/auth/login` - Authenticate and get JWT
- `POST /api/auth/verify-email` - Verify email token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/me` - Get current user

### Admin (NEW)
- `GET /api/admin/dashboard` - Overview stats
- `GET /api/admin/plans` - List plans
- `POST /api/admin/plans` - Create plan
- `PUT /api/admin/plans/:id` - Update plan
- `DELETE /api/admin/plans/:id` - Soft delete plan
- `GET /api/admin/settings/billing` - Get Stripe config (masked)
- `PATCH /api/admin/settings/billing` - Update Stripe config
- `GET /api/admin/tenants/list` - List tenants with filters
- `GET /api/admin/tenants/:id` - Tenant detail with stats
- `PUT /api/admin/tenants/:id/plan` - Change tenant plan
- `POST /api/admin/tenants/:id/cancel-subscription` - Cancel subscription
- `POST /api/admin/tenants/:id/notes` - Add admin note
- `DELETE /api/admin/tenants/:id/notes/:noteId` - Delete note
- `GET /api/admin/tenants/:id/exports/*.csv` - Export data
- `POST /api/admin/tenants/:id/impersonate` - Get impersonation token
- `GET /api/admin/messages` - List messages
- `POST /api/admin/messages` - Create message
- `DELETE /api/admin/messages/:id` - Delete message
- `GET /api/admin/audit-logs/enhanced` - Enhanced audit logs
- `GET /api/admin/fraud/bans` - List all bans
- `POST /api/admin/fraud/bans` - Create ban
- `DELETE /api/admin/fraud/bans/:type/:id` - Remove ban
- `GET /api/admin/fraud/flags/enhanced` - Enhanced fraud flags

### Tenant
- `GET /api/tenant/dashboard` - Tenant dashboard stats
- `GET /api/tenant/campaigns` - List campaigns
- `POST /api/tenant/campaigns` - Create campaign
- `PUT /api/tenant/campaigns/:id` - Update campaign
- `PUT /api/tenant/campaigns/:id/status` - Change status
- CRUD endpoints for prizes, staff, rewards

### Game (Public)
- `GET /api/game/:slug` - Get campaign for play
- `POST /api/game/:slug/play` - Submit play (server-side draw)

### Billing
- `GET /api/billing/plans` - List available plans
- `POST /api/billing/checkout` - Create Stripe session
- `GET /api/billing/subscription` - Get current subscription
- `GET /api/billing/invoices` - List payment history

## Testing
- Backend tests: `/app/backend/tests/test_admin_panel.py`
- Test reports: `/app/test_reports/iteration_2.json`
- All 41 backend tests passing (100%)
- All frontend UI flows verified working

## Next Tasks
1. Implement real email sending (SendGrid/Resend)
2. Configure Stripe live mode with real API keys
3. Add 2FA for Super Admin accounts
4. Build advanced analytics charts for tenant dashboard
5. Implement async export jobs for large datasets
