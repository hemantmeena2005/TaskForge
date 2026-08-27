import pytest
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest.mark.asyncio
async def test_get_dashboard_empty_projects(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"{PREFIX}/dashboard", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_projects"] == 0
    assert data["open_issues"] == 0
    assert data["completed_issues"] == 0
    assert isinstance(data["issues_by_status"], list)
    assert isinstance(data["issues_by_priority"], list)
    assert isinstance(data["recent_activity"], list)


@pytest.mark.asyncio
async def test_get_dashboard_with_projects_and_issues(client: AsyncClient, auth_headers: dict):
    # Create org
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Dash Org", "slug": "dash-org"},
    )
    org_id = org_res.json()["id"]

    # Create project
    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Dash Project", "key": "DASH"},
    )
    proj_id = proj_res.json()["id"]

    # Create issues
    await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Task 1", "type": "TASK", "priority": "HIGH"},
    )
    await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Task 2", "type": "BUG", "priority": "MEDIUM"},
    )

    # Get dashboard
    dash_res = await client.get(f"{PREFIX}/dashboard", headers=auth_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["total_projects"] >= 1
    assert dash_data["open_issues"] >= 2
    assert len(dash_data["recent_activity"]) >= 1

    # Get my projects
    proj_list_res = await client.get(f"{PREFIX}/dashboard/projects", headers=auth_headers)
    assert proj_list_res.status_code == 200
    assert len(proj_list_res.json()) >= 1


@pytest.mark.asyncio
async def test_get_dashboard_with_active_sprint(client: AsyncClient, auth_headers: dict):
    # Create org & project
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Sprint Org", "slug": "sprint-org"},
    )
    org_id = org_res.json()["id"]

    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Sprint Project", "key": "SPR"},
    )
    proj_id = proj_res.json()["id"]

    # Create sprint
    sprint_res = await client.post(
        f"{PREFIX}/projects/{proj_id}/sprints",
        headers=auth_headers,
        json={"name": "Sprint 1"},
    )
    sprint_id = sprint_res.json()["id"]

    # Start sprint
    await client.post(f"{PREFIX}/sprints/{sprint_id}/start", headers=auth_headers)

    # Create issues in sprint
    iss1 = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Sprint Task 1", "sprint_id": sprint_id},
    )
    iss2 = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Sprint Task 2", "sprint_id": sprint_id},
    )
    # Move one to DONE
    await client.post(
        f"{PREFIX}/issues/{iss1.json()['id']}/move",
        headers=auth_headers,
        json={"status": "DONE", "version": iss1.json()["version"]},
    )

    # Fetch dashboard
    dash_res = await client.get(f"{PREFIX}/dashboard", headers=auth_headers)
    assert dash_res.status_code == 200
    data = dash_res.json()
    assert data["active_sprint"] is not None
    assert data["active_sprint"]["name"] == "Sprint 1"
    assert data["sprint_progress"] is not None
    assert data["sprint_progress"]["total_issues"] == 2
    assert data["sprint_progress"]["completed_issues"] == 1
    assert data["sprint_progress"]["remaining_issues"] == 1
    assert data["sprint_progress"]["completion_percentage"] == 50.0
