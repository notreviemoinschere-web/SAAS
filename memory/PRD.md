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

## User Personas
1. **Super Admin**: Full system access, manage tenants/plans/billing
2. **Tenant Owner**: Business owner managing campaigns, prizes, staff, billing
3. **Tenant Staff**: Code redemption only
4. **Player**: Public user playing promotional games

## Core Requirements (Static)
- Multi-tenant architecture with strict tenant_id filtering
- RBAC: super_admin, tenant_owner, tenant_staff, player
- Deterministic server-side game engine (weighted random draw)
- Campaign lifecycle: Draft -> Test -> Active -> Paused -> Ended
- Fraud protection: max 2 plays per email_hash/phone_hash per campaign
- Consent registry: type, timestamp, IP, legal text version
- Cookie compliance: Accept/Reject/Manage with category-based consent
- Stripe subscription billing (Free/Pro/Business plans)
- Multi-language (EN/FR) with browser detection + manual toggle
- Audit logging for all sensitive actions

## What's Been Implemented (Feb 17, 2026)

### Backend
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
- [x] Admin dashboard (stats, tenant management, audit logs, fraud flags)
- [x] Plan enforcement (campaign limits, play limits, staff limits)
- [x] Super admin seeding on startup
- [x] Database indexing for performance

### Frontend
- [x] Landing page with hero, features, pricing
- [x] Auth flow: Login, Signup, Email Verification, Forgot/Reset Password
- [x] Admin Dashboard (stats, tenants list, audit logs, fraud alerts)
- [x] Tenant Dashboard (stats, campaigns, players, staff, rewards)
- [x] Campaign Editor (create/edit, prizes, status workflow)
- [x] Public Game Page (Wheel of Fortune with Canvas rendering)
- [x] Staff Redeem Interface (code verification + redemption)
- [x] Billing Page (plan comparison, Stripe checkout, invoice history)
- [x] Cookie Banner (Accept/Reject/Manage with category preferences)
- [x] Multi-language Toggle (EN/FR) on all pages
- [x] Responsive sidebar navigation (role-based)
- [x] Mobile-first player interface

### Credentials
- Super Admin: admin@prizewheelpro.com / Admin123!
- Test Tenant: test@example.com / Test123!
- Active Campaign: /play/summer-spin

## Prioritized Backlog

### P0 (Critical for Production)
- [ ] Real email sending for verification and password reset
- [ ] Stripe live mode configuration
- [ ] 2FA for Super Admin
- [ ] HTTPS enforcement
- [ ] Rate limiting on all auth endpoints

### P1 (Important Features)
- [ ] Data export (CSV) for Pro+ plans
- [ ] Advanced analytics with charts
- [ ] Multi-location support (Business plan)
- [ ] Webhook integration (player.created, play.completed, etc.)
- [ ] Custom domain support
- [ ] White-label branding

### P2 (Nice to Have)
- [ ] Admin impersonation with log + banner
- [ ] Batch code upload
- [ ] OTP verification (Business plan)
- [ ] Data retention auto-purge
- [ ] DSAR handling (data export/deletion)
- [ ] Legal page management with versioning
- [ ] Notification system (low stock, campaign ending, payment failure)
- [ ] Daily database backups
- [ ] Status page

## Next Tasks
1. Implement real email sending (SendGrid/Resend)
2. Add proper Stripe subscription management (not just one-time checkout)
3. Build advanced analytics with charts
4. Add data export functionality
5. Implement 2FA for admin accounts
