from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog
from app.audit.schemas import AuditLogResponse
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.enums import AuditAction, MemberRole
from app.core.exceptions import ForbiddenError
from app.core.permissions import require_project_member
from app.projects.models import Project, ProjectMember
from app.users.models import User

router = APIRouter(tags=["Audit Logs"])


@router.get("/projects/{project_id}/audit-logs", response_model=list[AuditLogResponse])
async def list_project_audit_logs(
    project_id: str,
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    action: Optional[AuditAction] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogResponse]:
    project, pmember = proj_and_member

    from sqlalchemy import or_

    query = (
        select(AuditLog)
        .where(
            or_(
                AuditLog.resource_type == "project",
                AuditLog.resource_type == "issue",
                AuditLog.resource_type == "sprint",
                AuditLog.resource_type == "project_member",
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )

    if action:
        query = query.where(AuditLog.action == action)

    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=str(l.id),
            user_id=str(l.user_id) if l.user_id else None,
            action=l.action,
            resource_type=l.resource_type,
            resource_id=str(l.resource_id) if l.resource_id else None,
            old_value=l.old_value,
            new_value=l.new_value,
            created_at=l.created_at,
        )
        for l in logs
    ]
