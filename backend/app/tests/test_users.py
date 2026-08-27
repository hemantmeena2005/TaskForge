import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_search_users_unauthorized(client: AsyncClient):
    res = await client.get(f"{settings.API_V1_PREFIX}/users")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_search_users_returns_list(client: AsyncClient, auth_headers: dict):
    # Register another user
    await client.post(
        f"{settings.API_V1_PREFIX}/auth/register",
        json={
            "email": "alice@example.com",
            "username": "alice_dev",
            "password": "securepassword123",
            "full_name": "Alice Developer",
        },
    )

    res = await client.get(f"{settings.API_V1_PREFIX}/users", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    assert any(u["username"] == "alice_dev" for u in data)


@pytest.mark.asyncio
async def test_search_users_filtering(client: AsyncClient, auth_headers: dict):
    await client.post(
        f"{settings.API_V1_PREFIX}/auth/register",
        json={
            "email": "bob.smith@example.com",
            "username": "bob_builder",
            "password": "securepassword123",
            "full_name": "Bob Smith",
        },
    )

    # Search by username substring
    res = await client.get(f"{settings.API_V1_PREFIX}/users?search=builder", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["username"] == "bob_builder"

    # Search by email substring
    res = await client.get(f"{settings.API_V1_PREFIX}/users?search=bob.smith", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["email"] == "bob.smith@example.com"

    # Search with no matches
    res = await client.get(f"{settings.API_V1_PREFIX}/users?search=nonexistentuserxyz", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0
