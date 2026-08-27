from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.core.enums import AuditAction


class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str]
    action: AuditAction
    resource_type: str
    resource_id: Optional[str]
    old_value: Optional[dict]
    new_value: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}
