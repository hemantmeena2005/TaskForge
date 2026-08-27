import pytest
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    response = await client.post(
        f"{PREFIX}/auth/register",
        json={
            "email": "new@example.com",
            "username": "newuser",
            "password": "securepass123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, registered_user: dict):
    response = await client.post(
        f"{PREFIX}/auth/register",
        json={
            "email": "test@example.com",
            "username": "another",
            "password": "securepass123",
        },
    )
    assert response.status_code == 409
    assert "Email already registered" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient, registered_user: dict):
    response = await client.post(
        f"{PREFIX}/auth/register",
        json={
            "email": "other@example.com",
            "username": "testuser",
            "password": "securepass123",
        },
    )
    assert response.status_code == 409
    assert "Username already taken" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient):
    response = await client.post(
        f"{PREFIX}/auth/register",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "short",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient):
    response = await client.post(
        f"{PREFIX}/auth/register",
        json={
            "email": "not-an-email",
            "username": "testuser",
            "password": "securepass123",
        },
    )
    assert response.status_code == 422
