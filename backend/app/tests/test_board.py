import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest_asyncio.fixture
async def setup_board_ctx(client: AsyncClient, auth_headers: dict):
    # Org
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Board Org", "slug": "board-org"},
    )
    org_id = org_res.json()["id"]

    # Project
    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Board Project", "key": "BRD"},
    )
    proj_id = proj_res.json()["id"]

    # Issues in different statuses
    i1 = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Todo Task", "status": "TODO", "priority": "HIGH"},
    )
    i2 = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "In Progress Task", "status": "IN_PROGRESS", "priority": "LOW"},
    )

    return {
        "org_id": org_id,
        "project_id": proj_id,
        "todo_issue": i1.json(),
        "in_progress_issue": i2.json(),
    }


@pytest.mark.asyncio
async def test_get_project_board_grouping(client: AsyncClient, auth_headers: dict, setup_board_ctx: dict):
    proj_id = setup_board_ctx["project_id"]

    res = await client.get(f"{PREFIX}/projects/{proj_id}/board", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["project_id"] == proj_id
    assert len(data["columns"]) == 4

    todo_col = next(c for c in data["columns"] if c["status"] == "TODO")
    in_prog_col = next(c for c in data["columns"] if c["status"] == "IN_PROGRESS")
    assert todo_col["total_count"] == 1
    assert in_prog_col["total_count"] == 1


@pytest.mark.asyncio
async def test_move_issue_status_success(client: AsyncClient, auth_headers: dict, setup_board_ctx: dict):
    issue = setup_board_ctx["todo_issue"]
    issue_id = issue["id"]
    current_version = issue["version"]

    res = await client.post(
        f"{PREFIX}/issues/{issue_id}/move",
        headers=auth_headers,
        json={"status": "IN_PROGRESS", "version": current_version},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "IN_PROGRESS"
    assert data["version"] == current_version + 1


@pytest.mark.asyncio
async def test_move_issue_optimistic_locking_conflict(client: AsyncClient, auth_headers: dict, setup_board_ctx: dict):
    issue = setup_board_ctx["todo_issue"]
    issue_id = issue["id"]
    current_version = issue["version"]

    # First move succeeds (increments version to 2)
    move1 = await client.post(
        f"{PREFIX}/issues/{issue_id}/move",
        headers=auth_headers,
        json={"status": "IN_PROGRESS", "version": current_version},
    )
    assert move1.status_code == 200

    # Second move with stale version (1 instead of 2) fails with 409 Conflict
    move2 = await client.post(
        f"{PREFIX}/issues/{issue_id}/move",
        headers=auth_headers,
        json={"status": "DONE", "version": current_version},
    )
    assert move2.status_code == 409
    assert "version" in move2.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_board_filtering_by_priority(client: AsyncClient, auth_headers: dict, setup_board_ctx: dict):
    proj_id = setup_board_ctx["project_id"]

    res = await client.get(f"{PREFIX}/projects/{proj_id}/board?priority=HIGH", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    todo_col = next(c for c in data["columns"] if c["status"] == "TODO")
    in_prog_col = next(c for c in data["columns"] if c["status"] == "IN_PROGRESS")
    assert todo_col["total_count"] == 1
    assert in_prog_col["total_count"] == 0
