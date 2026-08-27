import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest_asyncio.fixture
async def setup_sprint_ctx(client: AsyncClient, auth_headers: dict):
    # Org
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Sprint Org", "slug": "sprint-org"},
    )
    org_id = org_res.json()["id"]

    # Project
    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Sprint Project", "key": "SPT"},
    )
    proj_id = proj_res.json()["id"]

    return {"org_id": org_id, "project_id": proj_id}


@pytest.mark.asyncio
async def test_create_and_list_sprints(client: AsyncClient, auth_headers: dict, setup_sprint_ctx: dict):
    proj_id = setup_sprint_ctx["project_id"]

    res = await client.post(
        f"{PREFIX}/projects/{proj_id}/sprints",
        headers=auth_headers,
        json={"name": "Sprint 1", "goal": "Deliver auth & projects"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Sprint 1"
    assert data["status"] == "PLANNED"

    res_list = await client.get(f"{PREFIX}/projects/{proj_id}/sprints", headers=auth_headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1


@pytest.mark.asyncio
async def test_start_sprint_enforces_single_active(client: AsyncClient, auth_headers: dict, setup_sprint_ctx: dict):
    proj_id = setup_sprint_ctx["project_id"]

    s1 = await client.post(
        f"{PREFIX}/projects/{proj_id}/sprints",
        headers=auth_headers,
        json={"name": "Sprint Alpha"},
    )
    s1_id = s1.json()["id"]

    s2 = await client.post(
        f"{PREFIX}/projects/{proj_id}/sprints",
        headers=auth_headers,
        json={"name": "Sprint Beta"},
    )
    s2_id = s2.json()["id"]

    # Start Sprint Alpha
    start1 = await client.post(f"{PREFIX}/sprints/{s1_id}/start", headers=auth_headers)
    assert start1.status_code == 200
    assert start1.json()["status"] == "ACTIVE"

    # Try to start Sprint Beta (should fail with 409 Conflict)
    start2 = await client.post(f"{PREFIX}/sprints/{s2_id}/start", headers=auth_headers)
    assert start2.status_code == 409
    assert "already has an active sprint" in start2.json()["error"]["message"]


@pytest.mark.asyncio
async def test_add_and_remove_issues_from_sprint(client: AsyncClient, auth_headers: dict, setup_sprint_ctx: dict):
    proj_id = setup_sprint_ctx["project_id"]

    s = await client.post(
        f"{PREFIX}/projects/{proj_id}/sprints",
        headers=auth_headers,
        json={"name": "Sprint Gamma"},
    )
    s_id = s.json()["id"]

    i1 = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Sprint issue 1"},
    )
    i1_id = i1.json()["id"]

    # Add issue to sprint
    add_res = await client.post(
        f"{PREFIX}/sprints/{s_id}/issues",
        headers=auth_headers,
        json={"issue_ids": [i1_id]},
    )
    assert add_res.status_code == 200

    # Fetch issue, check sprint_id
    iss_res = await client.get(f"{PREFIX}/issues/{i1_id}", headers=auth_headers)
    assert iss_res.json()["sprint_id"] == s_id

    # Remove issue from sprint
    rem_res = await client.delete(f"{PREFIX}/sprints/{s_id}/issues/{i1_id}", headers=auth_headers)
    assert rem_res.status_code == 200

    iss_res2 = await client.get(f"{PREFIX}/issues/{i1_id}", headers=auth_headers)
    assert iss_res2.json()["sprint_id"] is None


@pytest.mark.asyncio
async def test_sprint_stats_and_completion(client: AsyncClient, auth_headers: dict, setup_sprint_ctx: dict):
    proj_id = setup_sprint_ctx["project_id"]

    # Create Sprint 1 & 2
    s1 = await client.post(
        f"{PREFIX}/projects/{proj_id}/sprints",
        headers=auth_headers,
        json={"name": "Sprint 101"},
    )
    s1_id = s1.json()["id"]

    s2 = await client.post(
        f"{PREFIX}/projects/{proj_id}/sprints",
        headers=auth_headers,
        json={"name": "Sprint 102"},
    )
    s2_id = s2.json()["id"]

    # Start Sprint 1
    await client.post(f"{PREFIX}/sprints/{s1_id}/start", headers=auth_headers)

    # Add 2 issues: 1 DONE, 1 TODO
    i1 = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Completed task", "status": "DONE"},
    )
    i2 = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Unfinished task", "status": "TODO"},
    )
    await client.post(
        f"{PREFIX}/sprints/{s1_id}/issues",
        headers=auth_headers,
        json={"issue_ids": [i1.json()["id"], i2.json()["id"]]},
    )

    # Check stats
    stats_res = await client.get(f"{PREFIX}/sprints/{s1_id}/stats", headers=auth_headers)
    assert stats_res.status_code == 200
    st = stats_res.json()
    assert st["total_issues"] == 2
    assert st["completed_issues"] == 1
    assert st["remaining_issues"] == 1
    assert st["completion_percentage"] == 50.0

    # Complete Sprint 1, moving unfinished issues to Sprint 2
    comp_res = await client.post(
        f"{PREFIX}/sprints/{s1_id}/complete",
        headers=auth_headers,
        json={"destination_sprint_id": s2_id},
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "COMPLETED"

    # Verify unfinished task moved to Sprint 2
    i2_check = await client.get(f"{PREFIX}/issues/{i2.json()['id']}", headers=auth_headers)
    assert i2_check.json()["sprint_id"] == s2_id
