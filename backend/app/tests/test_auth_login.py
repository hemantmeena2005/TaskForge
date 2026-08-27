import pytest
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, registered_user: dict):
    response = await client.post(
        f"{PREFIX}/auth/login",
        json={
            "email": "test@example.com",
            "password": "securepass123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, registered_user: dict):
    response = await client.post(
        f"{PREFIX}/auth/login",
        json={
            "email": "test@example.com",
            "password": "wrongpassword",
        },
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    response = await client.post(
        f"{PREFIX}/auth/login",
        json={
            "email": "nonexistent@example.com",
            "password": "securepass123",
        },
    )
    assert response.status_code == 401
