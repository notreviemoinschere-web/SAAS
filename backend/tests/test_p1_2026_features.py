"""
Test P1 2026 Features:
- New 2026 Game Design with prizes from campaign
- GDPR consent flow
- Copy code button and Google Review link
- Tenant Players page with filters and export
- Tenant Analytics page with charts
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
SUPER_ADMIN = {"email": "admin@prizewheelpro.com", "password": "Admin123!"}
TENANT_USER = {"email": "test@example.com", "password": "Test123!"}
TEST_CAMPAIGN_SLUG = "admin-test-campaign"


@pytest.fixture(scope="module")
def admin_token():
    """Get super admin authentication token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
    if resp.status_code == 200:
        return resp.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def tenant_token():
    """Get tenant owner authentication token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=TENANT_USER)
    if resp.status_code == 200:
        return resp.json().get("token")
    pytest.skip("Tenant authentication failed")


class TestGameEndpoint:
    """Test the 2026 game endpoint with embedded prizes"""

    def test_get_campaign_for_play(self):
        """Test GET /api/game/{slug} returns campaign with prizes"""
        resp = requests.get(f"{BASE_URL}/api/game/{TEST_CAMPAIGN_SLUG}?lang=fr")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        
        # Check campaign data
        assert "campaign" in data
        campaign = data["campaign"]
        assert campaign["slug"] == TEST_CAMPAIGN_SLUG
        assert "status" in campaign
        assert "terms_text" in campaign
        
        # Check prizes are returned (embedded prizes)
        assert "prizes" in data
        prizes = data["prizes"]
        assert len(prizes) >= 1, "Expected at least 1 prize"
        
        # Check prize structure
        for prize in prizes:
            assert "id" in prize
            assert "label" in prize
            # display_color is either custom or from NEON_COLORS

    def test_get_campaign_returns_tenant_info(self):
        """Test campaign endpoint returns tenant info for branding"""
        resp = requests.get(f"{BASE_URL}/api/game/{TEST_CAMPAIGN_SLUG}")
        assert resp.status_code == 200
        
        data = resp.json()
        assert "tenant" in data
        assert "name" in data["tenant"]
        
        # Tenant profile for Google review URL
        assert "tenant_profile" in data

    def test_get_campaign_invalid_slug(self):
        """Test 404 for invalid campaign slug"""
        resp = requests.get(f"{BASE_URL}/api/game/nonexistent-slug")
        assert resp.status_code == 404

    def test_play_game_requires_consent(self):
        """Test that playing requires GDPR consent"""
        play_data = {
            "email": "test_consent@example.com",
            "consent_accepted": False,
            "lang": "fr"
        }
        resp = requests.post(f"{BASE_URL}/api/game/{TEST_CAMPAIGN_SLUG}/play", json=play_data)
        assert resp.status_code == 400, "Should reject play without consent"

    def test_play_game_requires_email(self):
        """Test that playing requires email"""
        play_data = {
            "email": "",
            "consent_accepted": True,
            "lang": "fr"
        }
        resp = requests.post(f"{BASE_URL}/api/game/{TEST_CAMPAIGN_SLUG}/play", json=play_data)
        # Should fail validation
        assert resp.status_code in [400, 422]

    def test_play_game_success(self):
        """Test successful game play returns prize_index and reward"""
        unique_email = f"test_play_{int(time.time())}@test.com"
        play_data = {
            "email": unique_email,
            "first_name": "Test",
            "consent_accepted": True,
            "marketing_consent": True,
            "lang": "fr"
        }
        resp = requests.post(f"{BASE_URL}/api/game/{TEST_CAMPAIGN_SLUG}/play", json=play_data)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        # Should return won status and prize_index
        assert "won" in data
        assert "prize_index" in data
        assert "is_test" in data
        
        # If won, should have reward with code
        if data["won"]:
            assert "reward" in data
            assert "code" in data["reward"]
            assert "prize_label" in data["reward"]


class TestTenantPlayersEndpoint:
    """Test the new tenant players endpoint with filters"""

    def test_players_requires_auth(self):
        """Test players endpoint requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/tenant/players")
        assert resp.status_code in [401, 403]

    def test_players_list(self, tenant_token):
        """Test GET /api/tenant/players returns players with stats"""
        headers = {"Authorization": f"Bearer {tenant_token}"}
        resp = requests.get(f"{BASE_URL}/api/tenant/players?page=1&limit=20", headers=headers)
        assert resp.status_code == 200
        
        data = resp.json()
        # Check structure
        assert "players" in data
        assert "total" in data
        assert "pages" in data
        assert "page" in data
        assert "stats" in data
        
        # Check stats structure
        stats = data["stats"]
        assert "total" in stats
        assert "with_email" in stats
        assert "with_phone" in stats
        assert "marketing_consent" in stats

    def test_players_with_campaign_filter(self, tenant_token):
        """Test players can be filtered by campaign"""
        headers = {"Authorization": f"Bearer {tenant_token}"}
        
        # First get campaigns
        resp = requests.get(f"{BASE_URL}/api/tenant/campaigns", headers=headers)
        if resp.status_code == 200 and resp.json().get("campaigns"):
            campaign_id = resp.json()["campaigns"][0]["id"]
            
            resp = requests.get(
                f"{BASE_URL}/api/tenant/players?campaign_id={campaign_id}",
                headers=headers
            )
            assert resp.status_code == 200

    def test_players_with_search(self, tenant_token):
        """Test players can be searched"""
        headers = {"Authorization": f"Bearer {tenant_token}"}
        resp = requests.get(
            f"{BASE_URL}/api/tenant/players?search=test",
            headers=headers
        )
        assert resp.status_code == 200

    def test_players_pagination(self, tenant_token):
        """Test players pagination works"""
        headers = {"Authorization": f"Bearer {tenant_token}"}
        resp = requests.get(
            f"{BASE_URL}/api/tenant/players?page=1&limit=5",
            headers=headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["players"]) <= 5


class TestTenantAnalyticsEndpoint:
    """Test the new tenant analytics endpoint"""

    def test_analytics_requires_auth(self):
        """Test analytics endpoint requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/tenant/analytics")
        assert resp.status_code in [401, 403]

    def test_analytics_basic(self, tenant_token):
        """Test GET /api/tenant/analytics returns KPIs and charts data"""
        headers = {"Authorization": f"Bearer {tenant_token}"}
        resp = requests.get(f"{BASE_URL}/api/tenant/analytics?period=30d", headers=headers)
        assert resp.status_code == 200
        
        data = resp.json()
        # Check KPIs
        assert "total_plays" in data
        assert "total_wins" in data
        assert "unique_players" in data
        assert "conversion_rate" in data
        assert "codes_redeemed" in data
        assert "redemption_rate" in data
        
        # Check change metrics
        assert "plays_change" in data
        assert "wins_change" in data
        assert "players_change" in data
        
        # Check chart data arrays
        assert "plays_over_time" in data
        assert "prize_distribution" in data
        assert "hourly_distribution" in data
        assert "top_campaigns" in data
        assert "recent_activity" in data

    def test_analytics_different_periods(self, tenant_token):
        """Test analytics for different time periods"""
        headers = {"Authorization": f"Bearer {tenant_token}"}
        
        for period in ["7d", "30d", "90d", "365d"]:
            resp = requests.get(
                f"{BASE_URL}/api/tenant/analytics?period={period}",
                headers=headers
            )
            assert resp.status_code == 200, f"Failed for period {period}"

    def test_analytics_with_campaign_filter(self, tenant_token):
        """Test analytics can be filtered by campaign"""
        headers = {"Authorization": f"Bearer {tenant_token}"}
        
        # First get campaigns
        resp = requests.get(f"{BASE_URL}/api/tenant/campaigns", headers=headers)
        if resp.status_code == 200 and resp.json().get("campaigns"):
            campaign_id = resp.json()["campaigns"][0]["id"]
            
            resp = requests.get(
                f"{BASE_URL}/api/tenant/analytics?campaign_id={campaign_id}",
                headers=headers
            )
            assert resp.status_code == 200


class TestTenantCampaignsForSidebar:
    """Test that campaigns endpoint is available for sidebar navigation"""

    def test_tenant_campaigns_list(self, tenant_token):
        """Test tenant can get campaigns list for sidebar"""
        headers = {"Authorization": f"Bearer {tenant_token}"}
        resp = requests.get(f"{BASE_URL}/api/tenant/campaigns", headers=headers)
        assert resp.status_code == 200
        
        data = resp.json()
        assert "campaigns" in data


class TestPlayersExport:
    """Test the players export functionality"""

    def test_export_requires_auth(self):
        """Test export endpoint requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/tenant/players/export")
        assert resp.status_code in [401, 403]

    def test_export_csv(self, tenant_token):
        """Test CSV export (may require Pro plan)"""
        headers = {"Authorization": f"Bearer {tenant_token}"}
        resp = requests.get(f"{BASE_URL}/api/tenant/players/export", headers=headers)
        
        # Either returns CSV (200) or plan restriction (403)
        assert resp.status_code in [200, 403]
        
        if resp.status_code == 200:
            # Should be CSV content type
            assert "text/csv" in resp.headers.get("content-type", "")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
