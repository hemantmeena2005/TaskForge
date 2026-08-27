import pytest
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient, auth_headers: dict, registered_user: dict):
    response = await client.get(f"{PREFIX}/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["username"] == "testuser"
    assert data["full_name"] == "Test User"
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    response = await client.get(f"{PREFIX}/auth/me")
    assert response.status_code == 403  # HTTPBearer returns 403 when no credentials


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    response = await client.get(
        f"{PREFIX}/auth/me",
        headers={"Authorization": "Bearer invalid-token-here"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_change_password_success(client: AsyncClient, auth_headers: dict):
    response = await client.patch(
        f"{PREFIX}/auth/me/password",
        headers=auth_headers,
        json={
            "current_password": "securepass123",
            "new_password": "newsecurepass456",
        },
    )
    assert response.status_code == 200
    assert "Password changed" in response.json()["message"]

    # Verify we can login with new password
    login_response = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "test@example.com", "password": "newsecurepass456"},
    )
    assert login_response.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_current(client: AsyncClient, auth_headers: dict):
    response = await client.patch(
        f"{PREFIX}/auth/me/password",
        headers=auth_headers,
        json={
            "current_password": "wrongpassword",
            "new_password": "newsecurepass456",
        },
    )
    assert response.status_code == 401
