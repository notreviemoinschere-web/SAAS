#!/usr/bin/env python3
"""
PrizeWheel Pro Backend API Test Suite
Tests all backend functionality including auth, admin, tenant, game, and billing routes.
"""
import requests
import sys
from datetime import datetime
import json

# Use the public backend URL for testing
BASE_URL = "https://prize-wheel-pro.preview.emergentagent.com"

class PrizeWheelAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.tenant_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_result(self, test_name, success, response_data=None, error=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
            if response_data:
                print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
        else:
            self.failed_tests.append(test_name)
            print(f"❌ {test_name} - FAILED")
            if error:
                print(f"   Error: {error}")

    def make_request(self, method, endpoint, data=None, headers=None, token=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/api{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {}
            
            return response.status_code, response_data
        except Exception as e:
            return 0, {"error": str(e)}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        status, data = self.make_request('GET', '')
        success = status == 200 and 'PrizeWheel Pro API' in str(data)
        self.log_result("GET /api root endpoint", success, data)
        
        # Test health endpoint
        status, data = self.make_request('GET', '/health')
        success = status == 200 and data.get('status') == 'ok'
        self.log_result("GET /api/health", success, data)

    def test_translations(self):
        """Test translation endpoints"""
        print("\n🔍 Testing Translation Endpoints...")
        
        # Test English translations
        status, data = self.make_request('GET', '/translations/en')
        success = status == 200 and isinstance(data, dict)
        self.log_result("GET /api/translations/en", success, data)
        
        # Test French translations
        status, data = self.make_request('GET', '/translations/fr')
        success = status == 200 and isinstance(data, dict)
        self.log_result("GET /api/translations/fr", success, data)

    def test_admin_login(self):
        """Test admin authentication"""
        print("\n🔍 Testing Admin Authentication...")
        
        login_data = {
            "email": "admin@prizewheelpro.com",
            "password": "Admin123!"
        }
        
        status, data = self.make_request('POST', '/auth/login', login_data)
        success = status == 200 and 'token' in data
        
        if success:
            self.admin_token = data['token']
            user_data = data.get('user', {})
            success = user_data.get('role') == 'super_admin'
        
        self.log_result("Admin login", success, data)
        return success

    def test_tenant_login(self):
        """Test tenant authentication"""
        print("\n🔍 Testing Tenant Authentication...")
        
        login_data = {
            "email": "test@example.com", 
            "password": "Test123!"
        }
        
        status, data = self.make_request('POST', '/auth/login', login_data)
        success = status == 200 and 'token' in data
        
        if success:
            self.tenant_token = data['token']
            user_data = data.get('user', {})
            success = user_data.get('role') == 'tenant_owner'
        
        self.log_result("Tenant login", success, data)
        return success

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔍 Testing Authentication Endpoints...")
        
        if not self.admin_token:
            print("❌ Skipping auth tests - admin login failed")
            return
        
        # Test /auth/me endpoint
        status, data = self.make_request('GET', '/auth/me', token=self.admin_token)
        success = status == 200 and 'user' in data
        self.log_result("GET /auth/me (admin)", success, data)
        
        if self.tenant_token:
            status, data = self.make_request('GET', '/auth/me', token=self.tenant_token)
            success = status == 200 and 'user' in data and 'tenant' in data
            self.log_result("GET /auth/me (tenant)", success, data)

    def test_admin_dashboard(self):
        """Test admin dashboard endpoints"""
        print("\n🔍 Testing Admin Dashboard...")
        
        if not self.admin_token:
            print("❌ Skipping admin tests - admin login failed")
            return
        
        # Test dashboard stats
        status, data = self.make_request('GET', '/admin/dashboard', token=self.admin_token)
        success = status == 200 and 'total_tenants' in data
        self.log_result("GET /admin/dashboard", success, data)
        
        # Test tenants list
        status, data = self.make_request('GET', '/admin/tenants', token=self.admin_token)
        success = status == 200 and 'tenants' in data
        self.log_result("GET /admin/tenants", success, data)
        
        # Test audit logs
        status, data = self.make_request('GET', '/admin/audit-logs', token=self.admin_token)
        success = status == 200 and 'logs' in data
        self.log_result("GET /admin/audit-logs", success, data)
        
        # Test fraud flags
        status, data = self.make_request('GET', '/admin/fraud', token=self.admin_token)
        success = status == 200 and 'flags' in data
        self.log_result("GET /admin/fraud", success, data)

    def test_signup_flow(self):
        """Test user signup flow"""
        print("\n🔍 Testing Signup Flow...")
        
        # Create unique test user
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@testcorp.com"
        signup_data = {
            "business_name": f"Test Corp {datetime.now().strftime('%H%M%S')}",
            "email": test_email,
            "password": "TestPassword123!"
        }
        
        status, data = self.make_request('POST', '/auth/signup', signup_data)
        success = status == 200 and 'verification_token' in data
        self.log_result("POST /auth/signup", success, data)
        
        if success:
            # Test email verification
            verify_data = {"token": data['verification_token']}
            status, verify_response = self.make_request('POST', '/auth/verify-email', verify_data)
            success = status == 200
            self.log_result("POST /auth/verify-email", success, verify_response)

    def test_game_endpoints(self):
        """Test public game endpoints"""
        print("\n🔍 Testing Game Endpoints...")
        
        # Test get campaign (public endpoint)
        status, data = self.make_request('GET', '/game/summer-spin')
        success = status == 200 and 'campaign' in data and 'prizes' in data
        self.log_result("GET /game/summer-spin", success, data)
        
        if not success:
            print("❌ Campaign not found, skipping play test")
            return
        
        # Test game play
        play_data = {
            "email": f"player_{datetime.now().strftime('%H%M%S')}@test.com",
            "consent_accepted": True,
            "lang": "en"
        }
        
        status, data = self.make_request('POST', '/game/summer-spin/play', play_data)
        success = status == 200 and 'won' in data and 'prize_index' in data
        self.log_result("POST /game/summer-spin/play", success, data)

    def test_tenant_endpoints(self):
        """Test tenant-specific endpoints"""
        print("\n🔍 Testing Tenant Endpoints...")
        
        if not self.tenant_token:
            print("❌ Skipping tenant tests - tenant login failed")
            return
        
        # Test dashboard
        status, data = self.make_request('GET', '/tenant/dashboard', token=self.tenant_token)
        success = status == 200 and 'total_campaigns' in data
        self.log_result("GET /tenant/dashboard", success, data)
        
        # Test campaigns list
        status, data = self.make_request('GET', '/tenant/campaigns', token=self.tenant_token)
        success = status == 200 and 'campaigns' in data
        self.log_result("GET /tenant/campaigns", success, data)
        
        # Test rewards
        status, data = self.make_request('GET', '/tenant/rewards', token=self.tenant_token)
        success = status == 200 and 'rewards' in data
        self.log_result("GET /tenant/rewards", success, data)

    def test_billing_endpoints(self):
        """Test billing endpoints"""
        print("\n🔍 Testing Billing Endpoints...")
        
        # Test plans (public endpoint)
        status, data = self.make_request('GET', '/billing/plans')
        success = status == 200 and 'plans' in data and isinstance(data['plans'], dict)
        self.log_result("GET /billing/plans", success, data)

    def test_cookie_consent(self):
        """Test cookie consent endpoint"""
        print("\n🔍 Testing Cookie Consent...")
        
        consent_data = {
            "categories": {
                "essential": True,
                "analytics": False,
                "marketing": False
            }
        }
        
        status, data = self.make_request('POST', '/cookie-consent', consent_data)
        success = status == 200 and data.get('status') == 'ok'
        self.log_result("POST /cookie-consent", success, data)

    def run_all_tests(self):
        """Run comprehensive backend test suite"""
        print("🚀 Starting PrizeWheel Pro Backend API Test Suite...")
        print(f"Testing against: {self.base_url}")
        
        # Basic health checks
        self.test_health_endpoints()
        self.test_translations()
        
        # Authentication
        admin_login_success = self.test_admin_login()
        tenant_login_success = self.test_tenant_login()
        
        # Auth endpoints  
        self.test_auth_endpoints()
        
        # Admin functionality
        self.test_admin_dashboard()
        
        # Signup flow
        self.test_signup_flow()
        
        # Game functionality
        self.test_game_endpoints()
        
        # Tenant functionality
        self.test_tenant_endpoints()
        
        # Billing
        self.test_billing_endpoints()
        
        # Cookie consent
        self.test_cookie_consent()
        
        # Print summary
        print(f"\n📊 Test Summary")
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests:")
            for test in self.failed_tests:
                print(f"  - {test}")
        
        return len(self.failed_tests) == 0

def main():
    tester = PrizeWheelAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())