from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import MessageResponse
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.enums import NotificationType
from app.core.exceptions import NotFoundError
from app.notifications.models import Notification
from app.notifications.schemas import NotificationMarkRead, NotificationResponse
from app.users.models import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: User = Depends(get_current_active_user),
    is_read: Optional[bool] = Query(None),
    type: Optional[NotificationType] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    query = select(Notification).where(Notification.user_id == current_user.id)
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)
    if type:
        query = query.where(Notification.type == type)
    query = query.order_by(Notification.created_at.desc()).limit(limit)

    result = await db.execute(query)
    notifications = result.scalars().all()

    return [
        NotificationResponse(
            id=str(n.id),
            type=n.type,
            title=n.title,
            message=n.message,
            reference_type=n.reference_type,
            reference_id=str(n.reference_id) if n.reference_id else None,
            is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in notifications
    ]


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    res = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    count = res.scalar() or 0
    return {"unread_count": count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    body: NotificationMarkRead,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    try:
        n_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise NotFoundError("Notification", notification_id)

    res = await db.execute(
        select(Notification).where(
            Notification.id == n_uuid,
            Notification.user_id == current_user.id,
        )
    )
    notif = res.scalar_one_or_none()
    if not notif:
        raise NotFoundError("Notification", notification_id)

    notif.is_read = body.is_read
    await db.flush()
    await db.refresh(notif)

    return NotificationResponse(
        id=str(notif.id),
        type=notif.type,
        title=notif.title,
        message=notif.message,
        reference_type=notif.reference_type,
        reference_id=str(notif.reference_id) if notif.reference_id else None,
        is_read=notif.is_read,
        created_at=notif.created_at,
    )


@router.post("/mark-all-read", response_model=MessageResponse)
async def mark_all_read(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    res = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    for notif in res.scalars().all():
        notif.is_read = True

    return MessageResponse(message="All notifications marked as read")
