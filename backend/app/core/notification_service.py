from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import NotificationType
from app.notifications.models import Notification


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: NotificationType,
    title: str,
    message: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[uuid.UUID] = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(notif)
    return notif
