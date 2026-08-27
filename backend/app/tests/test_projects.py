import pytest
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest.mark.asyncio
async def test_create_project(client: AsyncClient, auth_headers: dict):
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Project Org", "slug": "proj-org"},
    )
    org_id = org_res.json()["id"]

    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "TaskForge Backend", "key": "TF", "description": "Backend service"},
    )
    assert proj_res.status_code == 201
    data = proj_res.json()
    assert data["name"] == "TaskForge Backend"
    assert data["key"] == "TF"
    assert data["organization_id"] == org_id


@pytest.mark.asyncio
async def test_project_key_unique_per_org(client: AsyncClient, auth_headers: dict):
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Unique Org", "slug": "unique-org"},
    )
    org_id = org_res.json()["id"]

    await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Project 1", "key": "DUP"},
    )
    res2 = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Project 2", "key": "DUP"},
    )
    assert res2.status_code == 409


@pytest.mark.asyncio
async def test_project_access_denied_for_non_members(client: AsyncClient, auth_headers: dict):
    # User 1 creates org & project
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Secret Org", "slug": "secret-org"},
    )
    org_id = org_res.json()["id"]
    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Secret Proj", "key": "SEC"},
    )
    proj_id = proj_res.json()["id"]

    # User 2
    reg2 = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "outsider@example.com", "username": "outsider", "password": "securepass123"},
    )
    h2 = {"Authorization": f"Bearer {reg2.json()['access_token']}"}

    # User 2 tries to access project
    res = await client.get(f"{PREFIX}/projects/{proj_id}", headers=h2)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_archive_project(client: AsyncClient, auth_headers: dict):
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Archive Org", "slug": "archive-org"},
    )
    org_id = org_res.json()["id"]
    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Old Proj", "key": "OLD"},
    )
    proj_id = proj_res.json()["id"]

    archive_res = await client.post(f"{PREFIX}/projects/{proj_id}/archive", headers=auth_headers)
    assert archive_res.status_code == 200
    assert archive_res.json()["is_archived"] is True


@pytest.mark.asyncio
async def test_delete_project_admin_only(client: AsyncClient, auth_headers: dict):
    # Org & project
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Del Proj Org", "slug": "del-proj-org"},
    )
    org_id = org_res.json()["id"]
    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "To Delete", "key": "DEL"},
    )
    proj_id = proj_res.json()["id"]

    # Developer user
    reg = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "dev_proj@example.com", "username": "dev_proj", "password": "securepass123"},
    )
    dev_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    me_res = await client.get(f"{PREFIX}/auth/me", headers=dev_headers)
    dev_user_id = me_res.json()["id"]

    await client.post(
        f"{PREFIX}/organizations/{org_id}/members",
        headers=auth_headers,
        json={"user_id": dev_user_id, "role": "developer"},
    )

    # Dev tries to delete -> 403 Forbidden
    del_dev = await client.delete(f"{PREFIX}/projects/{proj_id}", headers=dev_headers)
    assert del_dev.status_code == 403

    # Admin deletes -> 200 OK
    del_admin = await client.delete(f"{PREFIX}/projects/{proj_id}", headers=auth_headers)
    assert del_admin.status_code == 200

    # Project is gone
    get_res = await client.get(f"{PREFIX}/projects/{proj_id}", headers=auth_headers)
    assert get_res.status_code == 404
