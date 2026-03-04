"""
Basic health check tests to verify the application starts correctly.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.unit
async def test_root_endpoint(client: AsyncClient):
    """Test the root endpoint returns correct response."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Data Engineer Assessment Platform API"
    assert data["version"] == "1.0.0"
    assert data["status"] == "healthy"


@pytest.mark.unit
async def test_health_endpoint(client: AsyncClient):
    """Test the basic health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.integration
async def test_detailed_health_check(client: AsyncClient):
    """Test the detailed health check endpoint."""
    response = await client.get("/api/v1/health/detailed")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "service" in data
    assert "components" in data
    assert "mongodb" in data["components"]
    assert "redis" in data["components"]