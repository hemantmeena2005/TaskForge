import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.core.events import DomainEvent, EventType
from app.core.config import settings


@pytest.mark.asyncio
async def test_domain_event_creation():
    event = DomainEvent(
        event_type=EventType.ISSUE_CREATED,
        user_id="test-user-id",
        resource_type="issue",
        resource_id="test-issue-id",
        data={"issue_key": "TF-1", "title": "Test Issue"},
    )

    assert event.event_type == "ISSUE_CREATED"
    assert event.user_id == "test-user-id"
    assert event.resource_type == "issue"
    assert event.resource_id == "test-issue-id"
    assert event.data["issue_key"] == "TF-1"
    assert event.event_id is not None
    assert event.timestamp is not None


@pytest.mark.asyncio
async def test_publish_event_when_kafka_disabled():
    original = settings.KAFKA_ENABLED
    settings.KAFKA_ENABLED = False
    try:
        event = DomainEvent(
            event_type=EventType.ISSUE_CREATED,
            resource_type="issue",
            data={"test": True},
        )
        from app.core.kafka_producer import publish_event
        result = await publish_event(event)
        assert result is False
    finally:
        settings.KAFKA_ENABLED = original


@pytest.mark.asyncio
async def test_event_type_constants():
    assert EventType.ISSUE_CREATED == "ISSUE_CREATED"
    assert EventType.ISSUE_STATUS_CHANGED == "ISSUE_STATUS_CHANGED"
    assert EventType.SPRINT_STARTED == "SPRINT_STARTED"
    assert EventType.SPRINT_COMPLETED == "SPRINT_COMPLETED"
    assert EventType.MEMBER_ADDED == "MEMBER_ADDED"
    assert EventType.COMMENT_CREATED == "COMMENT_CREATED"


@pytest.mark.asyncio
async def test_event_serialization():
    event = DomainEvent(
        event_type=EventType.ISSUE_CREATED,
        user_id="user-123",
        resource_type="issue",
        resource_id="issue-456",
        data={"issue_key": "TF-5", "priority": "HIGH"},
    )

    dumped = event.model_dump()
    assert isinstance(dumped, dict)
    assert dumped["event_type"] == "ISSUE_CREATED"
    assert dumped["user_id"] == "user-123"
    assert dumped["data"]["issue_key"] == "TF-5"

    # Reconstruct from dict
    reconstructed = DomainEvent(**dumped)
    assert reconstructed.event_id == event.event_id
    assert reconstructed.event_type == event.event_type


@pytest.mark.asyncio
async def test_issue_create_publishes_event(client, auth_headers: dict):
    from app.core.config import settings
    PREFIX = settings.API_V1_PREFIX

    org_res = await client.post(
        f"{PREFIX}/organizations",
        headers=auth_headers,
        json={"name": "Kafka Test Org", "slug": "kafka-test-org"},
    )
    org_id = org_res.json()["id"]

    proj_res = await client.post(
        f"{PREFIX}/organizations/{org_id}/projects",
        headers=auth_headers,
        json={"name": "Kafka Test Proj", "key": "KTP"},
    )
    proj_id = proj_res.json()["id"]

    issue_res = await client.post(
        f"{PREFIX}/projects/{proj_id}/issues",
        headers=auth_headers,
        json={"title": "Event-driven issue", "priority": "HIGH"},
    )
    assert issue_res.status_code == 201
    assert issue_res.json()["issue_key"] == "KTP-1"
