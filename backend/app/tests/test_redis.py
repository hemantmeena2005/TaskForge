import pytest
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest.mark.asyncio
async def test_rate_limit_headers_on_login(client: AsyncClient, registered_user: dict):
    # Temporarily enable rate limiting for this test
    original = settings.RATE_LIMIT_ENABLED
    settings.RATE_LIMIT_ENABLED = True
    try:
        response = await client.post(
            f"{PREFIX}/auth/login",
            json={"email": "test@example.com", "password": "securepass123"},
        )
        assert response.status_code == 200
        # Rate limit headers should be present
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Window" in response.headers
        assert response.headers["X-RateLimit-Limit"] == "10"
        assert int(response.headers["X-RateLimit-Remaining"]) <= 10
    finally:
        settings.RATE_LIMIT_ENABLED = original


@pytest.mark.asyncio
async def test_org_cache_hit(client: AsyncClient, auth_headers: dict):
    # First request - cache miss (populates cache)
    res1 = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Cache Test Org", "slug": "cache-test-org"},
    )
    org_id = res1.json()["id"]

    get1 = await client.get(f"{PREFIX}/organizations/{org_id}", headers=auth_headers)
    assert get1.status_code == 200
    assert get1.json()["member_count"] == 1

    # Add member - should invalidate cache
    reg2 = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "cache-member@test.com", "username": "cachemember", "password": "securepass123"},
    )
    me2 = await client.get(f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {reg2.json()['access_token']}"})
    user2_id = me2.json()["id"]

    await client.post(
        f"{PREFIX}/organizations/{org_id}/members",
        headers=auth_headers,
        json={"user_id": user2_id, "role": "developer"},
    )

    # Second request - should reflect new member count (cache invalidated)
    get2 = await client.get(f"{PREFIX}/organizations/{org_id}", headers=auth_headers)
    assert get2.json()["member_count"] == 2


@pytest.mark.asyncio
async def test_project_cache_hit(client: AsyncClient, auth_headers: dict):
    # Create org + project
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Proj Cache Org", "slug": "proj-cache-org"},
    )
    org_id = org_res.json()["id"]

    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Proj Cache Test", "key": "PCT"},
    )
    proj_id = proj_res.json()["id"]

    # First GET - cache miss
    get1 = await client.get(f"{PREFIX}/projects/{proj_id}", headers=auth_headers)
    assert get1.status_code == 200
    assert get1.json()["name"] == "Proj Cache Test"

    # Update project - should invalidate cache
    await client.patch(
        f"{PREFIX}/projects/{proj_id}",
        headers=auth_headers,
        json={"name": "Proj Cache Updated"},
    )

    # Second GET - should return updated name (cache was invalidated)
    get2 = await client.get(f"{PREFIX}/projects/{proj_id}", headers=auth_headers)
    assert get2.json()["name"] == "Proj Cache Updated"
