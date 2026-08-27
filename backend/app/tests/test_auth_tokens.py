import pytest
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest.mark.asyncio
async def test_refresh_token_success(client: AsyncClient, registered_user: dict):
    response = await client.post(
        f"{PREFIX}/auth/refresh",
        json={"refresh_token": registered_user["refresh_token"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    # New refresh token should be different from the old one (rotation)
    assert data["refresh_token"] != registered_user["refresh_token"]


@pytest.mark.asyncio
async def test_refresh_token_invalid(client: AsyncClient):
    response = await client.post(
        f"{PREFIX}/auth/refresh",
        json={"refresh_token": "invalid-token"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_reuse_detected(client: AsyncClient, registered_user: dict):
    # First refresh should work
    response1 = await client.post(
        f"{PREFIX}/auth/refresh",
        json={"refresh_token": registered_user["refresh_token"]},
    )
    assert response1.status_code == 200

    # Reusing the old token should fail (it was revoked)
    response2 = await client.post(
        f"{PREFIX}/auth/refresh",
        json={"refresh_token": registered_user["refresh_token"]},
    )
    assert response2.status_code == 401


@pytest.mark.asyncio
async def test_logout_success(client: AsyncClient, registered_user: dict):
    response = await client.post(
        f"{PREFIX}/auth/logout",
        json={"refresh_token": registered_user["refresh_token"]},
    )
    assert response.status_code == 200
    assert "Logged out" in response.json()["message"]

    # Refreshing with the revoked token should fail
    refresh_response = await client.post(
        f"{PREFIX}/auth/refresh",
        json={"refresh_token": registered_user["refresh_token"]},
    )
    assert refresh_response.status_code == 401
