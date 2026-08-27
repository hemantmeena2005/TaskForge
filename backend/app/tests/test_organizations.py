import pytest
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest.mark.asyncio
async def test_create_organization(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={
            "name": "Acme Corp",
            "slug": "acme-corp",
            "description": "Acme Corporation Engineering",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Acme Corp"
    assert data["slug"] == "acme-corp"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_organization_duplicate_slug(client: AsyncClient, auth_headers: dict):
    await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Org 1", "slug": "unique-slug"},
    )
    response = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Org 2", "slug": "unique-slug"},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_user_organizations(client: AsyncClient, auth_headers: dict):
    await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "My Org", "slug": "my-org"},
    )
    response = await client.get(f"{PREFIX}/organizations", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(o["slug"] == "my-org" for o in data)


@pytest.mark.asyncio
async def test_org_member_isolation(client: AsyncClient, auth_headers: dict):
    # User 1 creates org
    res1 = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Private Org", "slug": "private-org"},
    )
    org_id = res1.json()["id"]

    # User 2 registers
    reg2 = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "user2@example.com", "username": "user2", "password": "securepass123"},
    )
    headers2 = {"Authorization": f"Bearer {reg2.json()['access_token']}"}

    # User 2 tries to access User 1's org
    get_res = await client.get(f"{PREFIX}/organizations/{org_id}", headers=headers2)
    assert get_res.status_code == 403


@pytest.mark.asyncio
async def test_add_and_remove_org_member(client: AsyncClient, auth_headers: dict):
    # Create org
    res1 = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Team Org", "slug": "team-org"},
    )
    org_id = res1.json()["id"]

    # Register member
    reg2 = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "member@example.com", "username": "member1", "password": "securepass123"},
    )
    user2_id = reg2.json()["access_token"]
    # Get user2 ID via /me endpoint
    me_res = await client.get(f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {user2_id}"})
    u2_id = me_res.json()["id"]

    # Add member
    add_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/members",
        headers=auth_headers,
        json={"user_id": u2_id, "role": "developer"},
    )
    assert add_res.status_code == 201
    assert add_res.json()["role"] == "developer"

    # List members
    members_res = await client.get(f"{PREFIX}/organizations/{org_id}/members", headers=auth_headers)
    assert members_res.status_code == 200
    assert len(members_res.json()) == 2

    # Remove member
    rem_res = await client.delete(f"{PREFIX}/organizations/{org_id}/members/{u2_id}", headers=auth_headers)
    assert rem_res.status_code == 200


@pytest.mark.asyncio
async def test_org_join_with_code_and_regenerate(client: AsyncClient, auth_headers: dict):
    # User 1 creates org
    res1 = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Orion Platform", "slug": "orion-platform"},
    )
    org_data = res1.json()
    org_id = org_data["id"]
    invite_code = org_data["invite_code"]
    assert invite_code is not None
    assert len(invite_code) == 8

    # User 2 registers
    reg2 = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "joiner@example.com", "username": "joiner_user", "password": "securepass123"},
    )
    headers2 = {"Authorization": f"Bearer {reg2.json()['access_token']}"}

    # User 2 joins using invite code
    join_res = await client.post(
        f"{PREFIX}/organizations/join",
        headers=headers2,
        json={"code": invite_code.lower()},  # Case-insensitive
    )
    assert join_res.status_code == 200
    assert join_res.json()["id"] == org_id

    # User 2 tries to join again -> 409 Conflict
    dup_join = await client.post(
        f"{PREFIX}/organizations/join",
        headers=headers2,
        json={"code": invite_code},
    )
    assert dup_join.status_code == 409

    # User 1 regenerates invite code
    regen_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/regenerate-invite-code",
        headers=auth_headers,
    )
    assert regen_res.status_code == 200
    new_code = regen_res.json()["invite_code"]
    assert new_code != invite_code
    assert len(new_code) == 8

    # Old code now invalid -> 404
    reg3 = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "user3@example.com", "username": "user3", "password": "securepass123"},
    )
    headers3 = {"Authorization": f"Bearer {reg3.json()['access_token']}"}
    old_join = await client.post(
        f"{PREFIX}/organizations/join",
        headers=headers3,
        json={"code": invite_code},
    )
    assert old_join.status_code == 404


@pytest.mark.asyncio
async def test_delete_organization_admin_only(client: AsyncClient, auth_headers: dict):
    # Create org
    res1 = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Org to Delete", "slug": "org-to-delete"},
    )
    org_id = res1.json()["id"]

    # Member user registers and joins
    reg = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "dev_user@example.com", "username": "dev_user", "password": "securepass123"},
    )
    dev_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    me_res = await client.get(f"{PREFIX}/auth/me", headers=dev_headers)
    dev_user_id = me_res.json()["id"]

    await client.post(
        f"{PREFIX}/organizations/{org_id}/members",
        headers=auth_headers,
        json={"user_id": dev_user_id, "role": "developer"},
    )

    # Developer tries to delete -> 403 Forbidden
    del_dev = await client.delete(f"{PREFIX}/organizations/{org_id}", headers=dev_headers)
    assert del_dev.status_code == 403

    # Admin deletes -> 200 OK
    del_admin = await client.delete(f"{PREFIX}/organizations/{org_id}", headers=auth_headers)
    assert del_admin.status_code == 200

    # Verify org is gone
    get_res = await client.get(f"{PREFIX}/organizations/{org_id}", headers=auth_headers)
    assert get_res.status_code == 404
