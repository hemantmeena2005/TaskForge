import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.config import settings

PREFIX = settings.API_V1_PREFIX


@pytest_asyncio.fixture
async def setup_phase7_ctx(client: AsyncClient, auth_headers: dict):
    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Phase7 Org", "slug": "phase7-org"},
    )
    org_id = org_res.json()["id"]

    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Phase7 Project", "key": "P7"},
    )
    proj_id = proj_res.json()["id"]

    issue_res = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Phase 7 test issue", "status": "TODO", "priority": "MEDIUM"},
    )
    issue_id = issue_res.json()["id"]
    issue_key = issue_res.json()["issue_key"]
    issue_version = issue_res.json()["version"]

    return {"org_id": org_id, "project_id": proj_id, "issue_id": issue_id, "issue_key": issue_key, "issue_version": issue_version}


@pytest.mark.asyncio
async def test_create_and_list_comments(client: AsyncClient, auth_headers: dict, setup_phase7_ctx: dict):
    issue_id = setup_phase7_ctx["issue_id"]

    # Add comment
    res = await client.post(
        f"{PREFIX}/issues/{issue_id}/comments",
        headers=auth_headers,
        json={"body": "This is a test comment on the issue."},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["body"] == "This is a test comment on the issue."
    comment_id = data["id"]

    # List comments
    list_res = await client.get(f"{PREFIX}/issues/{issue_id}/comments", headers=auth_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # Edit comment
    edit_res = await client.patch(
        f"{PREFIX}/comments/{comment_id}",
        headers=auth_headers,
        json={"body": "Edited comment body."},
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["body"] == "Edited comment body."

    # Delete comment
    del_res = await client.delete(f"{PREFIX}/comments/{comment_id}", headers=auth_headers)
    assert del_res.status_code == 200

    # Verify deleted
    list_res2 = await client.get(f"{PREFIX}/issues/{issue_id}/comments", headers=auth_headers)
    assert len(list_res2.json()) == 0


@pytest.mark.asyncio
async def test_notifications_on_assignment(client: AsyncClient, auth_headers: dict, setup_phase7_ctx: dict):
    # Register user 2
    reg2 = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "assignee@test.com", "username": "assignee", "password": "securepass123"},
    )
    me2 = await client.get(f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {reg2.json()['access_token']}"})
    user2_id = me2.json()["id"]
    headers2 = {"Authorization": f"Bearer {reg2.json()['access_token']}"}

    # Add user 2 to org
    org_id = setup_phase7_ctx["org_id"]
    await client.post(
        f"{PREFIX}/organizations/{org_id}/members",
        headers=auth_headers,
        json={"user_id": user2_id, "role": "developer"},
    )

    # Add user 2 to project
    proj_id = setup_phase7_ctx["project_id"]
    await client.post(
        f"{PREFIX}/projects/{proj_id}/members",
        headers=auth_headers,
        json={"user_id": user2_id, "role": "developer"},
    )

    # Create issue assigned to user 2
    issue_res = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Assigned issue", "assignee_id": user2_id},
    )
    assert issue_res.status_code == 201

    # User 2 should have a notification
    notif_res = await client.get(f"{PREFIX}/notifications", headers=headers2)
    assert notif_res.status_code == 200
    assert len(notif_res.json()) >= 1
    assert "assigned" in notif_res.json()[0]["message"].lower() or "assigned" in notif_res.json()[0]["title"].lower()


@pytest.mark.asyncio
async def test_notifications_on_status_change(client: AsyncClient, auth_headers: dict, setup_phase7_ctx: dict):
    # Register user 2
    reg2 = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "reporter@test.com", "username": "reporter", "password": "securepass123"},
    )
    me2 = await client.get(f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {reg2.json()['access_token']}"})
    user2_id = me2.json()["id"]
    headers2 = {"Authorization": f"Bearer {reg2.json()['access_token']}"}

    org_id = setup_phase7_ctx["org_id"]
    proj_id = setup_phase7_ctx["project_id"]

    await client.post(f"{PREFIX}/organizations/{org_id}/members", headers=auth_headers, json={"user_id": user2_id, "role": "developer"})
    await client.post(f"{PREFIX}/projects/{proj_id}/members", headers=auth_headers, json={"user_id": user2_id, "role": "developer"})

    # User 2 creates issue
    issue_res = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=headers2,
        json={"title": "Track status change", "status": "TODO"},
    )
    issue_id = issue_res.json()["id"]
    version = issue_res.json()["version"]

    # Admin moves it
    move_res = await client.post(
        f"{PREFIX}/issues/{issue_id}/move",
        headers=auth_headers,
        json={"status": "IN_PROGRESS", "version": version},
    )
    assert move_res.status_code == 200

    # User 2 should get notification
    notif_res = await client.get(f"{PREFIX}/notifications", headers=headers2)
    assert len(notif_res.json()) >= 1
    assert "status" in notif_res.json()[0]["message"].lower() or "moved" in notif_res.json()[0]["message"].lower()


@pytest.mark.asyncio
async def test_audit_logs_created(client: AsyncClient, auth_headers: dict, setup_phase7_ctx: dict):
    proj_id = setup_phase7_ctx["project_id"]
    issue_id = setup_phase7_ctx["issue_id"]
    issue_version = setup_phase7_ctx["issue_version"]

    # Move issue to generate audit log
    move_res = await client.post(
        f"{PREFIX}/issues/{issue_id}/move",
        headers=auth_headers,
        json={"status": "IN_REVIEW", "version": issue_version},
    )
    assert move_res.status_code == 200

    # Check audit logs via project endpoint
    audit_res = await client.get(
        f"{PREFIX}/projects/{proj_id}/audit-logs?limit=10",
        headers=auth_headers,
    )
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 1

    status_log = next((l for l in logs if l["action"] == "ISSUE_STATUS_CHANGED"), None)
    assert status_log is not None
    assert status_log["old_value"]["status"] == "TODO"
    assert status_log["new_value"]["status"] == "IN_REVIEW"


@pytest.mark.asyncio
async def test_notifications_mark_read(client: AsyncClient, auth_headers: dict, setup_phase7_ctx: dict):
    # Register user 2 to receive notifications
    reg2 = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "notifuser@test.com", "username": "notifuser", "password": "securepass123"},
    )
    me2 = await client.get(f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {reg2.json()['access_token']}"})
    user2_id = me2.json()["id"]
    headers2 = {"Authorization": f"Bearer {reg2.json()['access_token']}"}

    org_id = setup_phase7_ctx["org_id"]
    proj_id = setup_phase7_ctx["project_id"]

    await client.post(f"{PREFIX}/organizations/{org_id}/members", headers=auth_headers, json={"user_id": user2_id, "role": "developer"})
    await client.post(f"{PREFIX}/projects/{proj_id}/members", headers=auth_headers, json={"user_id": user2_id, "role": "developer"})

    # User 2 creates issue (so admin moving it generates notification for user 2)
    issue_res = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=headers2,
        json={"title": "Notif test issue", "status": "TODO"},
    )
    issue_id = issue_res.json()["id"]
    version = issue_res.json()["version"]

    # Admin moves it
    await client.post(
        f"{PREFIX}/issues/{issue_id}/move",
        headers=auth_headers,
        json={"status": "IN_PROGRESS", "version": version},
    )

    # Check unread count for user 2
    count_res = await client.get(f"{PREFIX}/notifications/unread-count", headers=headers2)
    assert count_res.status_code == 200
    assert count_res.json()["unread_count"] >= 1

    # Mark all read
    mark_res = await client.post(f"{PREFIX}/notifications/mark-all-read", headers=headers2)
    assert mark_res.status_code == 200

    # Verify count is 0
    count_res2 = await client.get(f"{PREFIX}/notifications/unread-count", headers=headers2)
    assert count_res2.json()["unread_count"] == 0
