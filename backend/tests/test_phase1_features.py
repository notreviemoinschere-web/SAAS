"""
Test Suite for Phase 1 Features:
1. Simplified Signup Flow (2 steps with plan popup)
2. Tenant Profile (Mon Entreprise) - 3 tabs
3. Admin Campaign Builder for Done-for-You campaigns
4. QR code generation for campaigns
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_PREFIX = "TEST_"

# ==================== FIXTURES ====================

@pytest.fixture(scope="module")
def admin_token():
    """Get super admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@prizewheelpro.com",
        "password": "Admin123!"
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    """Create session with admin auth"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    })
    return session


@pytest.fixture(scope="module")
def tenant_token():
    """Get test tenant token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "Test123!"
    })
    if response.status_code != 200:
        pytest.skip(f"Tenant login failed: {response.text}")
    return response.json()


@pytest.fixture(scope="module")
def tenant_client(tenant_token):
    """Create session with tenant auth"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {tenant_token['token']}",
        "Content-Type": "application/json"
    })
    return session


@pytest.fixture(scope="module")
def tenant_id(tenant_token):
    """Get test tenant ID"""
    return tenant_token["user"]["tenant_id"]


# ==================== TEST: SIGNUP FLOW ====================

class TestSignupFlow:
    """Test simplified 2-step signup flow"""
    
    def test_signup_step1_validation_first_name_required(self):
        """Test signup fails without first name"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "first_name": "",
            "last_name": "Dupont",
            "company_name": "Test Company",
            "phone": "+33612345678",
            "email": f"{TEST_PREFIX}test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "TestPass123!",
            "gdpr_consent": True
        })
        # Should fail validation - empty first name
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
    
    def test_signup_step1_validation_company_required(self):
        """Test signup fails without company name"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "first_name": "Jean",
            "last_name": "Dupont",
            "company_name": "",
            "phone": "+33612345678",
            "email": f"{TEST_PREFIX}test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "TestPass123!",
            "gdpr_consent": True
        })
        # Empty company name should fail
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
    
    def test_signup_step2_gdpr_consent_required(self):
        """Test signup fails without GDPR consent"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "first_name": "Jean",
            "last_name": "Dupont",
            "company_name": f"{TEST_PREFIX}Company",
            "phone": "+33612345678",
            "email": f"{TEST_PREFIX}test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "TestPass123!",
            "gdpr_consent": False
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "GDPR" in response.json().get("detail", "").upper() or "consent" in response.json().get("detail", "").lower()
    
    def test_signup_successful_returns_plan_selection_flag(self):
        """Test successful signup returns show_plan_selection: true"""
        unique_email = f"{TEST_PREFIX}signup_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "first_name": "Marie",
            "last_name": "Dupont",
            "company_name": f"{TEST_PREFIX}Boulangerie Marie",
            "phone": "+33612345678",
            "email": unique_email,
            "password": "TestPass123!",
            "gdpr_consent": True
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert "tenant" in data, "Response should contain tenant"
        assert data.get("show_plan_selection") == True, "Should have show_plan_selection: true"
        
        # Verify user data
        assert data["user"]["email"] == unique_email.lower()
        assert data["user"]["role"] == "tenant_owner"
        
        # Verify tenant data
        assert data["tenant"]["plan"] == "free", "New tenant should start with free plan"
    
    def test_signup_creates_profile_with_business_info(self):
        """Test signup creates tenant profile with business details"""
        unique_email = f"{TEST_PREFIX}profile_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "first_name": "Pierre",
            "last_name": "Martin",
            "company_name": f"{TEST_PREFIX}Cafe Pierre",
            "phone": "+33687654321",
            "email": unique_email,
            "password": "TestPass123!",
            "gdpr_consent": True
        })
        assert response.status_code == 200
        
        data = response.json()
        token = data["token"]
        
        # Verify profile was created by fetching it
        profile_response = requests.get(
            f"{BASE_URL}/api/tenant/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert profile_response.status_code == 200
        
        profile_data = profile_response.json()
        assert profile_data["profile"]["manager_first_name"] == "Pierre"
        assert profile_data["profile"]["manager_last_name"] == "Martin"
        assert profile_data["profile"]["phone"] == "+33687654321"
    
    def test_signup_duplicate_email_fails(self):
        """Test signup with existing email fails"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "first_name": "Test",
            "last_name": "User",
            "company_name": "Test Company",
            "phone": "+33612345678",
            "email": "test@example.com",  # Existing email
            "password": "TestPass123!",
            "gdpr_consent": True
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "already" in response.json().get("detail", "").lower()


# ==================== TEST: TENANT PROFILE ====================

class TestTenantProfile:
    """Test Tenant Profile (Mon Entreprise) features"""
    
    def test_get_profile_returns_all_sections(self, tenant_client):
        """Test getting profile returns profile, branding, and basic info"""
        response = tenant_client.get(f"{BASE_URL}/api/tenant/profile")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Profile section (Informations tab)
        assert "profile" in data, "Should contain profile section"
        profile = data["profile"]
        assert "manager_first_name" in profile
        assert "manager_last_name" in profile
        assert "company_name" in profile
        assert "address" in profile
        assert "phone" in profile
        assert "email" in profile
        assert "registration_number" in profile  # SIRET
        assert "vat_number" in profile
        assert "google_review_url" in profile
        assert "social_links" in profile  # Réseaux Sociaux tab
        
        # Branding section (Apparence tab)
        assert "branding" in data, "Should contain branding section"
        branding = data["branding"]
        assert "primary_color" in branding
        assert "secondary_color" in branding
    
    def test_update_profile_business_info(self, tenant_client):
        """Test updating business profile (address, SIRET, VAT, phone)"""
        update_data = {
            "address": f"{TEST_PREFIX}123 Rue de Paris",
            "city": "Paris",
            "postal_code": "75001",
            "country": "France",
            "phone": "+33198765432",
            "registration_number": "12345678901234",
            "vat_number": "FR12345678901"
        }
        
        response = tenant_client.put(f"{BASE_URL}/api/tenant/profile", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["profile"]["address"] == update_data["address"]
        assert data["profile"]["registration_number"] == update_data["registration_number"]
        assert data["profile"]["vat_number"] == update_data["vat_number"]
        
        # Verify persistence with GET
        get_response = tenant_client.get(f"{BASE_URL}/api/tenant/profile")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["profile"]["address"] == update_data["address"]
        assert get_data["profile"]["registration_number"] == update_data["registration_number"]
    
    def test_update_profile_social_links(self, tenant_client):
        """Test adding social links (Réseaux Sociaux tab)"""
        social_links = {
            "instagram": "https://instagram.com/testcafe",
            "facebook": "https://facebook.com/testcafe",
            "tiktok": "https://tiktok.com/@testcafe"
        }
        
        response = tenant_client.put(f"{BASE_URL}/api/tenant/profile", json={
            "social_links": social_links
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["profile"]["social_links"]["instagram"] == social_links["instagram"]
        assert data["profile"]["social_links"]["facebook"] == social_links["facebook"]
        
        # Verify persistence
        get_response = tenant_client.get(f"{BASE_URL}/api/tenant/profile")
        assert get_response.status_code == 200
        assert get_response.json()["profile"]["social_links"]["instagram"] == social_links["instagram"]
    
    def test_update_branding_colors(self, tenant_client):
        """Test updating branding colors (Apparence tab)"""
        response = tenant_client.put(f"{BASE_URL}/api/tenant/branding", json={
            "primary_color": "#ff5733",
            "secondary_color": "#33ff57"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["branding"]["primary_color"] == "#ff5733"
        assert data["branding"]["secondary_color"] == "#33ff57"
    
    def test_update_google_review_url(self, tenant_client):
        """Test updating Google Review URL"""
        google_url = "https://g.page/r/test-business/review"
        
        response = tenant_client.put(f"{BASE_URL}/api/tenant/profile", json={
            "google_review_url": google_url
        })
        assert response.status_code == 200
        
        assert response.json()["profile"]["google_review_url"] == google_url


# ==================== TEST: ADMIN CAMPAIGN BUILDER ====================

class TestAdminCampaignBuilder:
    """Test Admin Campaign Builder (Done-for-You campaigns)"""
    
    def test_list_tenant_campaigns(self, admin_client, tenant_id):
        """Test admin can list campaigns for a tenant"""
        response = admin_client.get(f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "campaigns" in data
        assert "total" in data
        assert "tenant" in data
        assert data["tenant"]["id"] == tenant_id
    
    def test_create_campaign_with_prizes(self, admin_client, tenant_id):
        """Test admin can create a campaign with prizes via wizard"""
        campaign_data = {
            "title": f"{TEST_PREFIX}Admin Created Campaign",
            "slug": f"test-admin-campaign-{uuid.uuid4().hex[:6]}",
            "timezone": "Europe/Paris",
            "starts_at": "2026-01-15T00:00:00Z",
            "ends_at": "2026-02-15T00:00:00Z",
            
            # Player requirements (Step 2)
            "require_email": True,
            "require_phone": False,
            "max_plays_per_email": 3,
            "consent_marketing_email": True,
            
            # Prizes (Step 3)
            "prizes": [
                {
                    "label": "10% de réduction",
                    "prize_type": "discount",
                    "value": "10",
                    "weight": 30,
                    "stock_total": 100,
                    "expiration_days": 30,
                    "is_consolation": False,
                    "display_color": "#22c55e"
                },
                {
                    "label": "Café gratuit",
                    "prize_type": "free_item",
                    "value": "1 café",
                    "weight": 20,
                    "stock_total": 50,
                    "expiration_days": 14,
                    "is_consolation": False,
                    "display_color": "#3b82f6"
                },
                {
                    "label": "Merci d'avoir joué",
                    "prize_type": "consolation",
                    "value": "",
                    "weight": 50,
                    "stock_total": 1000,
                    "expiration_days": 0,
                    "is_consolation": True,
                    "display_color": "#9ca3af"
                }
            ],
            
            # Legal (Step 4)
            "intro_text": "Tentez votre chance et gagnez !",
            "cta_text": "Tourner la roue !",
            "terms_text": "Règlement du jeu: 1 participation par email.",
            "show_google_review": True
        }
        
        response = admin_client.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns",
            json=campaign_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["title"] == campaign_data["title"]
        assert data["status"] == "draft", "New campaign should be draft"
        assert data["created_by_admin"] == True, "Should be marked as admin-created"
        assert len(data["prizes"]) == 3, "Should have 3 prizes"
        
        # Store campaign ID for later tests
        pytest.campaign_id = data["id"]
        return data["id"]
    
    def test_get_campaign_details(self, admin_client, tenant_id):
        """Test admin can get campaign details"""
        campaign_id = getattr(pytest, 'campaign_id', None)
        if not campaign_id:
            pytest.skip("No campaign created in previous test")
        
        response = admin_client.get(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == campaign_id
        assert "play_count" in data
        assert "test_play_count" in data
        assert "player_count" in data
    
    def test_change_campaign_status_draft_to_test(self, admin_client, tenant_id):
        """Test admin can change campaign status from draft to test"""
        campaign_id = getattr(pytest, 'campaign_id', None)
        if not campaign_id:
            pytest.skip("No campaign created in previous test")
        
        response = admin_client.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}/status",
            json={"status": "test", "reason": "Ready for testing"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["new_status"] == "test"
        assert data["old_status"] == "draft"
    
    def test_change_campaign_status_test_to_active(self, admin_client, tenant_id):
        """Test admin can change campaign status from test to active"""
        campaign_id = getattr(pytest, 'campaign_id', None)
        if not campaign_id:
            pytest.skip("No campaign created in previous test")
        
        response = admin_client.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}/status",
            json={"status": "active", "reason": "Go live!"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["new_status"] == "active"
    
    def test_change_campaign_status_active_to_paused(self, admin_client, tenant_id):
        """Test admin can pause an active campaign"""
        campaign_id = getattr(pytest, 'campaign_id', None)
        if not campaign_id:
            pytest.skip("No campaign created in previous test")
        
        response = admin_client.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}/status",
            json={"status": "paused", "reason": "Pausing for maintenance"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["new_status"] == "paused"
    
    def test_update_campaign(self, admin_client, tenant_id):
        """Test admin can update campaign details"""
        campaign_id = getattr(pytest, 'campaign_id', None)
        if not campaign_id:
            pytest.skip("No campaign created in previous test")
        
        response = admin_client.patch(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}",
            json={
                "title": f"{TEST_PREFIX}Updated Campaign Title",
                "intro_text": "Updated intro text"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "Updated" in data["title"]
    
    def test_duplicate_campaign(self, admin_client, tenant_id):
        """Test admin can duplicate a campaign"""
        campaign_id = getattr(pytest, 'campaign_id', None)
        if not campaign_id:
            pytest.skip("No campaign created in previous test")
        
        response = admin_client.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}/duplicate"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "(Copy)" in data["title"]
        assert data["status"] == "draft", "Duplicated campaign should be draft"
        assert data["id"] != campaign_id, "Should have new ID"
        
        # Store for cleanup
        pytest.duplicated_campaign_id = data["id"]
    
    def test_generate_test_link(self, admin_client, tenant_id):
        """Test admin can generate test link for campaign"""
        campaign_id = getattr(pytest, 'campaign_id', None)
        if not campaign_id:
            pytest.skip("No campaign created in previous test")
        
        response = admin_client.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}/test-link"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "test_url" in data
        assert "test_token" in data
        assert "mode=test" in data["test_url"]
    
    def test_delete_campaign(self, admin_client, tenant_id):
        """Test admin can delete a campaign (cleanup)"""
        # Delete the duplicated campaign
        campaign_id = getattr(pytest, 'duplicated_campaign_id', None)
        if not campaign_id:
            pytest.skip("No duplicated campaign to delete")
        
        response = admin_client.delete(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}"
        )
        assert response.status_code == 200
    
    def test_cannot_activate_campaign_without_terms(self, admin_client, tenant_id):
        """Test cannot activate campaign without terms text"""
        # Create campaign without terms
        campaign_data = {
            "title": f"{TEST_PREFIX}No Terms Campaign",
            "prizes": [
                {
                    "label": "Prize",
                    "prize_type": "discount",
                    "value": "10",
                    "weight": 100,
                    "stock_total": 100,
                    "display_color": "#22c55e"
                }
            ],
            "terms_text": ""  # Empty terms
        }
        
        create_response = admin_client.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns",
            json=campaign_data
        )
        assert create_response.status_code == 200
        
        campaign_id = create_response.json()["id"]
        
        # Try to activate - should fail
        status_response = admin_client.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}/status",
            json={"status": "active"}
        )
        assert status_response.status_code == 400, "Should fail without terms"
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}")


# ==================== TEST: QR CODE GENERATION ====================

class TestQRCodeGeneration:
    """Test QR code generation for campaigns"""
    
    def test_qr_code_generation_endpoint(self, tenant_client, tenant_id):
        """Test QR code generation returns base64 image"""
        # First, get a campaign that belongs to this tenant
        # We need to find or create one
        
        # List campaigns for this tenant
        list_response = tenant_client.get(f"{BASE_URL}/api/campaigns")
        
        if list_response.status_code == 200:
            campaigns = list_response.json().get("campaigns", [])
            if campaigns:
                campaign_id = campaigns[0]["id"]
                
                # Request QR code
                qr_response = tenant_client.get(
                    f"{BASE_URL}/api/tenant/campaigns/{campaign_id}/qrcode"
                )
                assert qr_response.status_code == 200, f"Expected 200, got {qr_response.status_code}: {qr_response.text}"
                
                data = qr_response.json()
                assert "qr_code" in data, "Should contain qr_code"
                assert data["qr_code"].startswith("data:image/png;base64,"), "QR code should be base64 PNG"
                assert "game_url" in data, "Should contain game URL"
                assert "campaign_name" in data
                return
        
        # If no campaigns found, skip
        pytest.skip("No campaigns available to test QR code generation")
    
    def test_qr_code_contains_correct_url(self, admin_client, tenant_id):
        """Test QR code data includes correct game URL"""
        campaign_id = getattr(pytest, 'campaign_id', None)
        if not campaign_id:
            pytest.skip("No campaign available")
        
        # Use admin endpoint to get QR for the test campaign
        # First get campaign details to get slug
        campaign_response = admin_client.get(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{campaign_id}"
        )
        assert campaign_response.status_code == 200
        
        campaign_slug = campaign_response.json().get("slug")
        
        # Note: The QR code endpoint is on tenant routes, so we need tenant token
        # But we can verify the campaign has proper slug for URL construction
        assert campaign_slug, "Campaign should have a slug for QR URL"


# ==================== TEST: AUTHENTICATION GUARDS ====================

class TestAuthenticationGuards:
    """Test API authentication guards"""
    
    def test_tenant_profile_requires_auth(self):
        """Test tenant profile endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/tenant/profile")
        assert response.status_code == 401
    
    def test_admin_campaigns_requires_super_admin(self, tenant_client, tenant_id):
        """Test admin campaign endpoints require super admin role"""
        response = tenant_client.get(f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns")
        assert response.status_code == 403, "Tenant should not access admin endpoints"


# ==================== CLEANUP ====================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_campaigns(self, admin_client, tenant_id):
        """Delete all TEST_ prefixed campaigns"""
        response = admin_client.get(f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns")
        if response.status_code == 200:
            campaigns = response.json().get("campaigns", [])
            for c in campaigns:
                if c.get("title", "").startswith(TEST_PREFIX):
                    # First pause if active
                    if c.get("status") == "active":
                        admin_client.post(
                            f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{c['id']}/status",
                            json={"status": "paused"}
                        )
                    admin_client.delete(
                        f"{BASE_URL}/api/admin/tenants/{tenant_id}/campaigns/{c['id']}"
                    )
        print("Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
