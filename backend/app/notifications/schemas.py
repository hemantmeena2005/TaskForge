from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.core.enums import NotificationType


class NotificationResponse(BaseModel):
    id: str
    type: NotificationType
    title: str
    message: str
    reference_type: Optional[str]
    reference_id: Optional[str]
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationMarkRead(BaseModel):
    is_read: bool = True
