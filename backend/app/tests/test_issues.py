import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest_asyncio.fixture
async def setup_project_ctx(client: AsyncClient, auth_headers: dict):
    # Create org
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Issue Org", "slug": "issue-org"},
    )
    org_id = org_res.json()["id"]

    # Create project
    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "TaskForge Web", "key": "TFW"},
    )
    proj_id = proj_res.json()["id"]

    return {"org_id": org_id, "project_id": proj_id}


@pytest.mark.asyncio
async def test_create_and_list_labels(client: AsyncClient, auth_headers: dict, setup_project_ctx: dict):
    org_id = setup_project_ctx["org_id"]

    res = await client.post(
        f"{PREFIX}/organizations/{org_id}/labels",
        headers=auth_headers,
        json={"name": "frontend", "color": "#3B82F6"},
    )
    assert res.status_code == 201
    assert res.json()["name"] == "frontend"

    res_list = await client.get(f"{PREFIX}/organizations/{org_id}/labels", headers=auth_headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1


@pytest.mark.asyncio
async def test_create_issue_sequential_key(client: AsyncClient, auth_headers: dict, setup_project_ctx: dict):
    proj_id = setup_project_ctx["project_id"]

    res1 = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={
            "title": "First issue",
            "type": "TASK",
            "priority": "HIGH",
        },
    )
    assert res1.status_code == 201
    d1 = res1.json()
    assert d1["issue_number"] == 1
    assert d1["issue_key"] == "TFW-1"

    res2 = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={
            "title": "Second issue",
            "type": "BUG",
            "priority": "URGENT",
        },
    )
    assert res2.status_code == 201
    d2 = res2.json()
    assert d2["issue_number"] == 2
    assert d2["issue_key"] == "TFW-2"


@pytest.mark.asyncio
async def test_list_issues_with_filters_and_pagination(client: AsyncClient, auth_headers: dict, setup_project_ctx: dict):
    proj_id = setup_project_ctx["project_id"]

    await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Fix login bug", "type": "BUG", "status": "TODO", "priority": "HIGH"},
    )
    await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Implement dashboard", "type": "FEATURE", "status": "IN_PROGRESS", "priority": "LOW"},
    )

    # Filter by type BUG
    res_bug = await client.get(f"{PREFIX}/projects/{proj_id}/issues?type=BUG", headers=auth_headers)
    assert res_bug.status_code == 200
    data = res_bug.json()
    assert data["meta"]["total"] == 1
    assert data["items"][0]["title"] == "Fix login bug"

    # Search query
    res_search = await client.get(f"{PREFIX}/projects/{proj_id}/issues?search=dashboard", headers=auth_headers)
    assert res_search.status_code == 200
    assert res_search.json()["meta"]["total"] == 1


@pytest.mark.asyncio
async def test_get_issue_by_key_and_id(client: AsyncClient, auth_headers: dict, setup_project_ctx: dict):
    proj_id = setup_project_ctx["project_id"]

    res_create = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Test fetch", "type": "STORY"},
    )
    issue_id = res_create.json()["id"]
    issue_key = res_create.json()["issue_key"]

    # Fetch by ID
    res_id = await client.get(f"{PREFIX}/issues/{issue_id}", headers=auth_headers)
    assert res_id.status_code == 200
    assert res_id.json()["id"] == issue_id

    # Fetch by Key
    res_key = await client.get(f"{PREFIX}/issues/{issue_key}", headers=auth_headers)
    assert res_key.status_code == 200
    assert res_key.json()["issue_key"] == issue_key


@pytest.mark.asyncio
async def test_update_and_delete_issue(client: AsyncClient, auth_headers: dict, setup_project_ctx: dict):
    proj_id = setup_project_ctx["project_id"]

    res_create = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Original Title", "status": "TODO"},
    )
    issue_id = res_create.json()["id"]

    # Update issue
    res_patch = await client.patch(
        f"{PREFIX}/issues/{issue_id}",
        headers=auth_headers,
        json={"title": "Updated Title", "status": "IN_PROGRESS"},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["title"] == "Updated Title"
    assert res_patch.json()["status"] == "IN_PROGRESS"
    assert res_patch.json()["version"] == 2

    # Delete issue
    res_del = await client.delete(f"{PREFIX}/issues/{issue_id}", headers=auth_headers)
    assert res_del.status_code == 200

    # Fetch deleted issue should be 404
    res_get = await client.get(f"{PREFIX}/issues/{issue_id}", headers=auth_headers)
    assert res_get.status_code == 404
