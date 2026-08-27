from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog
from app.core.enums import AuditAction


async def create_audit_log(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    action: AuditAction,
    resource_type: str,
    resource_id: uuid.UUID | None = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(log)
    return log
