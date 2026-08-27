from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field


class DomainEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    user_id: Optional[str] = None
    resource_type: str
    resource_id: Optional[str] = None
    data: dict[str, Any] = Field(default_factory=dict)


# Event type constants
class EventType:
    ISSUE_CREATED = "ISSUE_CREATED"
    ISSUE_UPDATED = "ISSUE_UPDATED"
    ISSUE_DELETED = "ISSUE_DELETED"
    ISSUE_ASSIGNED = "ISSUE_ASSIGNED"
    ISSUE_STATUS_CHANGED = "ISSUE_STATUS_CHANGED"
    ISSUE_PRIORITY_CHANGED = "ISSUE_PRIORITY_CHANGED"
    SPRINT_CREATED = "SPRINT_CREATED"
    SPRINT_STARTED = "SPRINT_STARTED"
    SPRINT_COMPLETED = "SPRINT_COMPLETED"
    MEMBER_ADDED = "MEMBER_ADDED"
    MEMBER_REMOVED = "MEMBER_REMOVED"
    COMMENT_CREATED = "COMMENT_CREATED"
