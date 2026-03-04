"""
Simple health check tests without database dependencies.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import create_application


@pytest.fixture
def client():
    """Create test client without database dependencies."""
    app = create_application()
    return TestClient(app)


def test_root_endpoint(client):
    """Test the root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Data Engineer Assessment Platform API"
    assert data["version"] == "1.0.0"
    assert data["status"] == "healthy"


def test_basic_health_endpoint(client):
    """Test the basic health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"