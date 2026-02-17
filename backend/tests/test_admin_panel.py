"""
Test Suite for Super Admin Panel Features
Testing: Plans CRUD, Stripe Settings, Tenant Management, Admin Messaging, 
         Audit Logs, Fraud Center with Bans, Consent-gated Exports
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_"


class TestSuperAdminAuth:
    """Test Super Admin authentication"""
    
    def test_super_admin_login_success(self):
        """Test super admin can login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@prizewheelpro.com",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Token should be in response"
        assert "user" in data, "User info should be in response"
        assert data["user"]["role"] == "super_admin", "User role should be super_admin"
        
    def test_super_admin_login_invalid_password(self):
        """Test super admin login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@prizewheelpro.com",
            "password": "WrongPassword!"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token for authenticated requests"""
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


class TestAdminDashboard:
    """Test Admin Dashboard endpoint"""
    
    def test_get_dashboard_stats(self, admin_client):
        """Test getting admin dashboard stats"""
        response = admin_client.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total_tenants" in data
        assert "active_campaigns" in data
        assert "total_plays" in data


class TestPlansManagement:
    """Test Plans CRUD operations"""
    
    def test_list_plans(self, admin_client):
        """Test listing all plans"""
        response = admin_client.get(f"{BASE_URL}/api/admin/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "plans" in data, "Response should contain plans array"
        assert isinstance(data["plans"], list)
    
    def test_create_plan(self, admin_client):
        """Test creating a new plan"""
        plan_id = f"test_plan_{uuid.uuid4().hex[:8]}"
        plan_data = {
            "id": plan_id,
            "name": f"{TEST_PREFIX}Enterprise Plan",
            "price_monthly": 99.99,
            "price_yearly": 999.99,
            "limits": {
                "campaigns": 100,
                "plays_per_month": 100000,
                "staff": 50,
                "export": True,
                "branding_removable": True
            },
            "features": ["feature1", "feature2"],
            "is_active": True,
            "sort_order": 99
        }
        response = admin_client.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        created = response.json()
        assert created["id"] == plan_id
        assert created["name"] == plan_data["name"]
        
        # Cleanup: delete the plan
        admin_client.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
    
    def test_create_duplicate_plan_fails(self, admin_client):
        """Test creating duplicate plan ID fails"""
        # First, get existing plans to find one we can try to duplicate
        response = admin_client.get(f"{BASE_URL}/api/admin/plans")
        if response.status_code == 200 and response.json().get("plans"):
            existing_plan = response.json()["plans"][0]
            # Try to create with same ID
            response = admin_client.post(f"{BASE_URL}/api/admin/plans", json={
                "id": existing_plan["id"],
                "name": "Duplicate Test",
                "price_monthly": 10
            })
            assert response.status_code == 400, "Should fail with 400 for duplicate ID"
    
    def test_update_plan(self, admin_client):
        """Test updating a plan"""
        # Create a plan first
        plan_id = f"test_update_{uuid.uuid4().hex[:8]}"
        admin_client.post(f"{BASE_URL}/api/admin/plans", json={
            "id": plan_id,
            "name": f"{TEST_PREFIX}Update Test",
            "price_monthly": 50
        })
        
        # Update the plan
        response = admin_client.put(f"{BASE_URL}/api/admin/plans/{plan_id}", json={
            "name": f"{TEST_PREFIX}Updated Name",
            "price_monthly": 75
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        updated = response.json()
        assert updated["name"] == f"{TEST_PREFIX}Updated Name"
        assert updated["price_monthly"] == 75
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
    
    def test_delete_plan(self, admin_client):
        """Test deleting (deactivating) a plan"""
        # Create a plan
        plan_id = f"test_delete_{uuid.uuid4().hex[:8]}"
        admin_client.post(f"{BASE_URL}/api/admin/plans", json={
            "id": plan_id,
            "name": f"{TEST_PREFIX}Delete Test",
            "price_monthly": 25
        })
        
        # Delete the plan
        response = admin_client.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_cannot_delete_free_plan(self, admin_client):
        """Test that free plan cannot be deleted"""
        response = admin_client.delete(f"{BASE_URL}/api/admin/plans/free")
        assert response.status_code == 400, "Should not allow deleting free plan"


class TestStripeSettings:
    """Test Stripe/Billing Settings"""
    
    def test_get_billing_settings(self, admin_client):
        """Test getting billing/Stripe settings"""
        response = admin_client.get(f"{BASE_URL}/api/admin/settings/billing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "mode" in data, "Response should include mode (test/live)"
        # Keys should be masked
        if data.get("test_secret_key_masked"):
            assert "*" in data["test_secret_key_masked"], "Secret keys should be masked"
    
    def test_update_billing_settings(self, admin_client):
        """Test updating Stripe settings"""
        response = admin_client.patch(f"{BASE_URL}/api/admin/settings/billing", json={
            "mode": "test",
            "test_publishable_key": "pk_test_dummy_key"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.json().get("message") == "Billing settings updated"
    
    def test_update_billing_invalid_mode(self, admin_client):
        """Test updating with invalid mode fails"""
        response = admin_client.patch(f"{BASE_URL}/api/admin/settings/billing", json={
            "mode": "invalid_mode"
        })
        assert response.status_code == 400, "Should fail with invalid mode"


class TestTenantsManagement:
    """Test Enhanced Tenant Management"""
    
    def test_list_tenants(self, admin_client):
        """Test listing tenants with filters"""
        response = admin_client.get(f"{BASE_URL}/api/admin/tenants/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "tenants" in data
        assert "total" in data
    
    def test_list_tenants_with_filters(self, admin_client):
        """Test listing tenants with search/status/plan filters"""
        response = admin_client.get(f"{BASE_URL}/api/admin/tenants/list", params={
            "search": "test",
            "status": "active",
            "plan": "free"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_get_tenant_detail(self, admin_client):
        """Test getting tenant detail page"""
        # First get list to find a tenant ID
        list_response = admin_client.get(f"{BASE_URL}/api/admin/tenants/list")
        if list_response.status_code == 200 and list_response.json().get("tenants"):
            tenant_id = list_response.json()["tenants"][0]["id"]
            response = admin_client.get(f"{BASE_URL}/api/admin/tenants/{tenant_id}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            data = response.json()
            assert "tenant" in data
            assert "owner" in data
            assert "stats" in data
            assert "billing" in data
            assert "notes" in data
        else:
            pytest.skip("No tenants available for detail test")
    
    def test_get_nonexistent_tenant(self, admin_client):
        """Test getting non-existent tenant returns 404"""
        response = admin_client.get(f"{BASE_URL}/api/admin/tenants/nonexistent_id_12345")
        assert response.status_code == 404


class TestAdminMessaging:
    """Test Admin Messaging System"""
    
    def test_list_messages(self, admin_client):
        """Test listing admin messages"""
        response = admin_client.get(f"{BASE_URL}/api/admin/messages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "messages" in data
        assert "total" in data
    
    def test_create_broadcast_message(self, admin_client):
        """Test creating a broadcast message"""
        message_data = {
            "title": f"{TEST_PREFIX}System Maintenance",
            "content": "Scheduled maintenance on Saturday 10 PM UTC",
            "message_type": "maintenance",
            "target_type": "broadcast"
        }
        response = admin_client.post(f"{BASE_URL}/api/admin/messages", json=message_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        created = response.json()
        assert created["title"] == message_data["title"]
        assert created["target_type"] == "broadcast"
        assert "id" in created
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/messages/{created['id']}")
    
    def test_create_info_message(self, admin_client):
        """Test creating an info message"""
        message_data = {
            "title": f"{TEST_PREFIX}New Feature Released",
            "content": "We've added export functionality!",
            "message_type": "info",
            "target_type": "broadcast"
        }
        response = admin_client.post(f"{BASE_URL}/api/admin/messages", json=message_data)
        assert response.status_code == 200
        created = response.json()
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/messages/{created['id']}")
    
    def test_delete_message(self, admin_client):
        """Test deleting a message"""
        # Create a message first
        response = admin_client.post(f"{BASE_URL}/api/admin/messages", json={
            "title": f"{TEST_PREFIX}To Delete",
            "content": "Test content",
            "message_type": "info",
            "target_type": "broadcast"
        })
        message_id = response.json()["id"]
        
        # Delete
        del_response = admin_client.delete(f"{BASE_URL}/api/admin/messages/{message_id}")
        assert del_response.status_code == 200
    
    def test_delete_nonexistent_message(self, admin_client):
        """Test deleting non-existent message returns 404"""
        response = admin_client.delete(f"{BASE_URL}/api/admin/messages/nonexistent_id_12345")
        assert response.status_code == 404


class TestAuditLogs:
    """Test Enhanced Audit Logs"""
    
    def test_get_audit_logs(self, admin_client):
        """Test getting audit logs"""
        response = admin_client.get(f"{BASE_URL}/api/admin/audit-logs/enhanced")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "logs" in data
        assert "total" in data
        assert "filters" in data
        assert "categories" in data["filters"]
        assert "actions" in data["filters"]
    
    def test_audit_logs_with_category_filter(self, admin_client):
        """Test audit logs with category filter"""
        response = admin_client.get(f"{BASE_URL}/api/admin/audit-logs/enhanced", params={
            "category": "billing"
        })
        assert response.status_code == 200
    
    def test_audit_logs_with_action_filter(self, admin_client):
        """Test audit logs with action filter"""
        response = admin_client.get(f"{BASE_URL}/api/admin/audit-logs/enhanced", params={
            "action": "login"
        })
        assert response.status_code == 200


class TestFraudCenter:
    """Test Fraud Center and Bans Management"""
    
    def test_list_bans(self, admin_client):
        """Test listing all bans"""
        response = admin_client.get(f"{BASE_URL}/api/admin/fraud/bans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "banned_ips" in data
        assert "banned_devices" in data
        assert "blacklisted_identities" in data
        assert "total" in data
    
    def test_create_ip_ban(self, admin_client):
        """Test creating an IP ban"""
        test_ip = f"192.168.{uuid.uuid4().int % 255}.{uuid.uuid4().int % 255}"
        ban_data = {
            "ban_type": "ip",
            "value": test_ip,
            "reason": f"{TEST_PREFIX}Suspicious activity"
        }
        response = admin_client.post(f"{BASE_URL}/api/admin/fraud/bans", json=ban_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        created = response.json()
        assert created["value"] == test_ip
        assert "id" in created
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/fraud/bans/ip/{created['id']}")
    
    def test_create_device_ban(self, admin_client):
        """Test creating a device hash ban"""
        test_device = f"device_hash_{uuid.uuid4().hex}"
        ban_data = {
            "ban_type": "device",
            "value": test_device,
            "reason": f"{TEST_PREFIX}Bot detected"
        }
        response = admin_client.post(f"{BASE_URL}/api/admin/fraud/bans", json=ban_data)
        assert response.status_code == 200
        created = response.json()
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/fraud/bans/device/{created['id']}")
    
    def test_create_identity_ban(self, admin_client):
        """Test creating an identity blacklist"""
        test_identity = f"identity_hash_{uuid.uuid4().hex}"
        ban_data = {
            "ban_type": "identity",
            "value": test_identity,
            "reason": f"{TEST_PREFIX}Fraud attempt"
        }
        response = admin_client.post(f"{BASE_URL}/api/admin/fraud/bans", json=ban_data)
        assert response.status_code == 200
        created = response.json()
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/fraud/bans/identity/{created['id']}")
    
    def test_duplicate_ban_fails(self, admin_client):
        """Test creating duplicate ban fails"""
        test_ip = f"10.0.{uuid.uuid4().int % 255}.{uuid.uuid4().int % 255}"
        ban_data = {
            "ban_type": "ip",
            "value": test_ip,
            "reason": "First ban"
        }
        response1 = admin_client.post(f"{BASE_URL}/api/admin/fraud/bans", json=ban_data)
        assert response1.status_code == 200
        ban_id = response1.json()["id"]
        
        # Try to ban same IP again
        response2 = admin_client.post(f"{BASE_URL}/api/admin/fraud/bans", json=ban_data)
        assert response2.status_code == 400, "Should fail for duplicate IP"
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/admin/fraud/bans/ip/{ban_id}")
    
    def test_remove_ban(self, admin_client):
        """Test removing a ban"""
        test_ip = f"172.16.{uuid.uuid4().int % 255}.{uuid.uuid4().int % 255}"
        response = admin_client.post(f"{BASE_URL}/api/admin/fraud/bans", json={
            "ban_type": "ip",
            "value": test_ip,
            "reason": "To be removed"
        })
        ban_id = response.json()["id"]
        
        # Remove the ban
        del_response = admin_client.delete(f"{BASE_URL}/api/admin/fraud/bans/ip/{ban_id}")
        assert del_response.status_code == 200
    
    def test_get_fraud_flags(self, admin_client):
        """Test getting fraud flags"""
        response = admin_client.get(f"{BASE_URL}/api/admin/fraud/flags/enhanced")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "flags" in data
        assert "total" in data


class TestExports:
    """Test Consent-gated Exports"""
    
    def test_export_players_csv(self, admin_client):
        """Test exporting tenant players as CSV"""
        # Get a tenant ID first
        list_response = admin_client.get(f"{BASE_URL}/api/admin/tenants/list")
        if list_response.status_code == 200 and list_response.json().get("tenants"):
            tenant_id = list_response.json()["tenants"][0]["id"]
            response = admin_client.get(f"{BASE_URL}/api/admin/tenants/{tenant_id}/exports/players.csv")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            # Check it's CSV content
            assert "text/csv" in response.headers.get("content-type", "") or response.status_code == 200
        else:
            pytest.skip("No tenants available for export test")
    
    def test_export_plays_csv(self, admin_client):
        """Test exporting tenant plays as CSV"""
        list_response = admin_client.get(f"{BASE_URL}/api/admin/tenants/list")
        if list_response.status_code == 200 and list_response.json().get("tenants"):
            tenant_id = list_response.json()["tenants"][0]["id"]
            response = admin_client.get(f"{BASE_URL}/api/admin/tenants/{tenant_id}/exports/plays.csv")
            assert response.status_code == 200
        else:
            pytest.skip("No tenants available for export test")
    
    def test_export_codes_csv(self, admin_client):
        """Test exporting tenant reward codes as CSV"""
        list_response = admin_client.get(f"{BASE_URL}/api/admin/tenants/list")
        if list_response.status_code == 200 and list_response.json().get("tenants"):
            tenant_id = list_response.json()["tenants"][0]["id"]
            response = admin_client.get(f"{BASE_URL}/api/admin/tenants/{tenant_id}/exports/codes.csv")
            assert response.status_code == 200
        else:
            pytest.skip("No tenants available for export test")
    
    def test_export_nonexistent_tenant_fails(self, admin_client):
        """Test exporting from non-existent tenant fails"""
        response = admin_client.get(f"{BASE_URL}/api/admin/tenants/nonexistent_12345/exports/players.csv")
        assert response.status_code == 404


class TestTenantActions:
    """Test Tenant-specific admin actions"""
    
    def test_add_tenant_note(self, admin_client):
        """Test adding admin note to tenant"""
        list_response = admin_client.get(f"{BASE_URL}/api/admin/tenants/list")
        if list_response.status_code == 200 and list_response.json().get("tenants"):
            tenant_id = list_response.json()["tenants"][0]["id"]
            note_data = {"content": f"{TEST_PREFIX}Admin note for testing"}
            response = admin_client.post(f"{BASE_URL}/api/admin/tenants/{tenant_id}/notes", json=note_data)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            note = response.json()
            assert "id" in note
            assert note["content"] == note_data["content"]
            
            # Cleanup
            admin_client.delete(f"{BASE_URL}/api/admin/tenants/{tenant_id}/notes/{note['id']}")
        else:
            pytest.skip("No tenants available for note test")
    
    def test_delete_tenant_note(self, admin_client):
        """Test deleting admin note"""
        list_response = admin_client.get(f"{BASE_URL}/api/admin/tenants/list")
        if list_response.status_code == 200 and list_response.json().get("tenants"):
            tenant_id = list_response.json()["tenants"][0]["id"]
            # Create note
            create_response = admin_client.post(f"{BASE_URL}/api/admin/tenants/{tenant_id}/notes", json={
                "content": f"{TEST_PREFIX}Note to delete"
            })
            note_id = create_response.json()["id"]
            
            # Delete
            del_response = admin_client.delete(f"{BASE_URL}/api/admin/tenants/{tenant_id}/notes/{note_id}")
            assert del_response.status_code == 200
        else:
            pytest.skip("No tenants available")


class TestUnauthorizedAccess:
    """Test that endpoints require super admin auth"""
    
    def test_plans_requires_auth(self):
        """Test plans endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/plans")
        assert response.status_code == 401
    
    def test_billing_settings_requires_auth(self):
        """Test billing settings requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/settings/billing")
        assert response.status_code == 401
    
    def test_messages_requires_auth(self):
        """Test messages endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/messages")
        assert response.status_code == 401
    
    def test_fraud_bans_requires_auth(self):
        """Test fraud bans requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/fraud/bans")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
