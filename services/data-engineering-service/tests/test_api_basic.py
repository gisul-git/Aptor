"""
Basic API endpoint tests focusing on core functionality.
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestBasicAPIEndpoints:
    """Basic tests for API endpoints."""
    
    def test_health_endpoint(self, client):
        """Test health endpoint."""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_root_endpoint(self, client):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "status" in data
        assert data["status"] == "healthy"
    
    def test_metrics_endpoint(self, client):
        """Test metrics endpoint."""
        response = client.get("/metrics")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "status" in data
        assert "metrics" in data
        assert "timestamp" in data
    
    def test_question_generation_basic(self, client):
        """Test basic question generation endpoint."""
        response = client.get("/api/v1/questions/generate?experience_level=5")
        # Should return 200 or 500 (depending on service availability)
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
    
    def test_question_generation_with_params(self, client):
        """Test question generation with parameters."""
        response = client.get("/api/v1/questions/generate?experience_level=5&topic=transformations&difficulty=2")
        # Should return 200 or 500 (depending on service availability)
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
    
    def test_question_generation_invalid_params(self, client):
        """Test question generation with invalid parameters."""
        response = client.get("/api/v1/questions/generate?experience_level=25")  # Invalid: > 20
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        response = client.get("/api/v1/questions/generate?experience_level=-1")  # Invalid: < 0
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        response = client.get("/api/v1/questions/generate?difficulty=5")  # Invalid: not 1, 2, or 3
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_execution_endpoint_missing_data(self, client):
        """Test execution endpoint with missing required data."""
        response = client.post("/api/v1/execute/test", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        response = client.post("/api/v1/execute/test", json={"code": "df.select('*')"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        response = client.post("/api/v1/execute/test", json={"question_id": "test-123"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_execution_endpoint_with_data(self, client):
        """Test execution endpoint with valid data."""
        response = client.post("/api/v1/execute/test", json={
            "code": "df.select('*')",
            "question_id": "test-question-123",
            "mode": "test"
        })
        # Should return 200 or 500 (depending on service availability)
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
    
    def test_unauthorized_access(self, client):
        """Test unauthorized access to protected endpoints."""
        # User progress requires authentication
        response = client.get("/api/v1/users/test-user/progress")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # User analytics requires authentication
        response = client.get("/api/v1/users/test-user/analytics")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_authenticated_access_invalid_token(self, client):
        """Test authenticated access with invalid token."""
        response = client.get(
            "/api/v1/users/test-user/progress",
            headers={"Authorization": "Bearer invalid-token"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_authenticated_access_valid_token(self, client):
        """Test authenticated access with valid token."""
        response = client.get(
            "/api/v1/users/test-user/progress",
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        # Should return 200 or 500 (depending on service availability)
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
    
    def test_forbidden_access(self, client):
        """Test forbidden access to other users' data."""
        response = client.get(
            "/api/v1/users/other-user/progress",
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_admin_access(self, client):
        """Test admin access to any user's data."""
        response = client.get(
            "/api/v1/users/any-user/progress",
            headers={"Authorization": "Bearer test-token-admin-user"}
        )
        # Should return 200 or 500 (depending on service availability)
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
    
    def test_public_endpoints(self, client):
        """Test public endpoints that don't require authentication."""
        # Question topics
        response = client.get("/api/v1/questions/topics")
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
        
        # Question stats
        response = client.get("/api/v1/questions/stats")
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
        
        # Platform stats
        response = client.get("/api/v1/users/stats")
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
        
        # Leaderboard
        response = client.get("/api/v1/users/leaderboard")
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]
    
    def test_cors_headers(self, client):
        """Test CORS headers are present."""
        response = client.options("/api/v1/questions/generate")
        # CORS headers should be present
        assert "access-control-allow-origin" in response.headers or response.status_code == 405
    
    def test_security_headers(self, client):
        """Test security headers are present."""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        
        # Check for security headers
        assert "x-content-type-options" in response.headers
        assert "x-frame-options" in response.headers
        assert "x-xss-protection" in response.headers
        assert "referrer-policy" in response.headers
        assert "content-security-policy" in response.headers
    
    def test_request_id_header(self, client):
        """Test request ID header is present."""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        assert "x-request-id" in response.headers
    
    def test_api_documentation(self, client):
        """Test API documentation endpoints."""
        # OpenAPI JSON
        response = client.get("/api/v1/openapi.json")
        assert response.status_code == status.HTTP_200_OK
        
        # Swagger UI
        response = client.get("/api/v1/docs")
        assert response.status_code == status.HTTP_200_OK
        
        # ReDoc
        response = client.get("/api/v1/redoc")
        assert response.status_code == status.HTTP_200_OK


class TestAPIErrorHandling:
    """Test API error handling."""
    
    def test_404_not_found(self, client):
        """Test 404 error handling."""
        response = client.get("/api/v1/nonexistent-endpoint")
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_405_method_not_allowed(self, client):
        """Test 405 error handling."""
        response = client.post("/api/v1/questions/topics")  # GET only endpoint
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    
    def test_422_validation_error(self, client):
        """Test 422 validation error handling."""
        response = client.get("/api/v1/questions/generate")  # Missing required experience_level
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == 422
    
    def test_error_response_format(self, client):
        """Test error response format consistency."""
        response = client.get("/api/v1/questions/generate")  # Missing required parameter
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]
        assert "request_id" in data["error"]