from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.enums import IssuePriority, IssueStatus, SprintStatus
from app.issues.models import Issue
from app.organizations.models import OrganizationMember
from app.projects.models import Project, ProjectMember
from app.sprints.models import Sprint
from app.audit.models import AuditLog
from app.dashboard.schemas import (
    ActiveSprintInfo,
    DashboardActivityItem,
    DashboardResponse,
    MyProject,
    PriorityCount,
    SprintProgress,
    StatusCount,
)
from app.users.models import User

router = APIRouter(tags=["Dashboard"])

_ALL_STATUSES = list(IssueStatus)
_ALL_PRIORITIES = list(IssuePriority)


async def _user_project_ids(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    # 1. Projects where user is an explicit project member
    pm_sub = select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)

    # 2. Projects in organizations where user is an organization member
    om_sub = (
        select(Project.id)
        .join(OrganizationMember, OrganizationMember.organization_id == Project.organization_id)
        .where(OrganizationMember.user_id == user_id)
    )

    query = select(Project.id).where(
        or_(Project.id.in_(pm_sub), Project.id.in_(om_sub)),
        Project.is_archived.is_(False),
    )
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/dashboard/projects", response_model=list[MyProject])
async def list_my_projects(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[MyProject]:
    project_ids = await _user_project_ids(db, current_user.id)
    if not project_ids:
        return []

    result = await db.execute(
        select(Project).where(Project.id.in_(project_ids)).order_by(Project.name)
    )
    projects = result.scalars().all()
    return [
        MyProject(
            id=str(p.id),
            name=p.name,
            key=p.key,
            description=p.description,
            is_archived=p.is_archived,
        )
        for p in projects
    ]


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    project_ids = await _user_project_ids(db, current_user.id)

    total_projects = len(project_ids)

    open_issues = 0
    completed_issues = 0
    issues_by_status: dict[IssueStatus, int] = {s: 0 for s in _ALL_STATUSES}
    issues_by_priority: dict[IssuePriority, int] = {p: 0 for p in _ALL_PRIORITIES}

    if project_ids:
        # Aggregated issue counts grouped by status
        status_res = await db.execute(
            select(Issue.status, func.count(Issue.id))
            .where(Issue.project_id.in_(project_ids))
            .group_by(Issue.status)
        )
        for st_val, count in status_res.all():
            try:
                st_enum = IssueStatus(st_val) if isinstance(st_val, str) else st_val
                if st_enum in issues_by_status:
                    issues_by_status[st_enum] = int(count)
            except (ValueError, KeyError):
                pass

        priority_res = await db.execute(
            select(Issue.priority, func.count(Issue.id))
            .where(Issue.project_id.in_(project_ids))
            .group_by(Issue.priority)
        )
        for pr_val, count in priority_res.all():
            try:
                pr_enum = IssuePriority(pr_val) if isinstance(pr_val, str) else pr_val
                if pr_enum in issues_by_priority:
                    issues_by_priority[pr_enum] = int(count)
            except (ValueError, KeyError):
                pass

        completed_issues = issues_by_status.get(IssueStatus.DONE, 0)
        open_issues = sum(
            v for k, v in issues_by_status.items() if k != IssueStatus.DONE
        )

    # Active sprint (most recently started) across user's projects
    active_sprint: ActiveSprintInfo | None = None
    sprint_progress: SprintProgress | None = None
    if project_ids:
        sprint_res = await db.execute(
            select(Sprint, Project.name)
            .join(Project, Project.id == Sprint.project_id)
            .where(
                Sprint.project_id.in_(project_ids),
                Sprint.status == SprintStatus.ACTIVE,
            )
            .order_by(Sprint.start_date.desc().nullslast())
            .limit(1)
        )
        row = sprint_res.first()
        if row is not None:
            sprint, project_name = row
            active_sprint = ActiveSprintInfo(
                id=str(sprint.id),
                project_id=str(sprint.project_id),
                project_name=project_name,
                name=sprint.name,
                goal=sprint.goal,
                start_date=sprint.start_date,
                end_date=sprint.end_date,
            )
            total = 0
            completed = 0
            if sprint.id is not None:
                tot_res = await db.execute(
                    select(func.count(Issue.id)).where(Issue.sprint_id == sprint.id)
                )
                total = int(tot_res.scalar() or 0)

                done_res = await db.execute(
                    select(func.count(Issue.id)).where(
                        Issue.sprint_id == sprint.id,
                        Issue.status == IssueStatus.DONE,
                    )
                )
                completed = int(done_res.scalar() or 0)

            sprint_progress = SprintProgress(
                total_issues=total,
                completed_issues=completed,
                remaining_issues=max(0, total - completed),
                completion_percentage=round((completed / total * 100.0), 1)
                if total > 0
                else 0.0,
            )

    # Recent activity (audit logs) across the user's projects
    recent_activity: list[DashboardActivityItem] = []
    if project_ids:
        issue_ids_sub = select(Issue.id).where(Issue.project_id.in_(project_ids))
        sprint_ids_sub = select(Sprint.id).where(Sprint.project_id.in_(project_ids))

        act_res = await db.execute(
            select(AuditLog)
            .where(
                or_(
                    AuditLog.resource_id.in_(project_ids),
                    AuditLog.resource_id.in_(issue_ids_sub),
                    AuditLog.resource_id.in_(sprint_ids_sub),
                )
            )
            .order_by(AuditLog.created_at.desc())
            .limit(10)
        )
        logs = act_res.scalars().all()
        for l in logs:
            action_name = l.action.value if hasattr(l.action, "value") else str(l.action)
            recent_activity.append(
                DashboardActivityItem(
                    id=str(l.id),
                    action=action_name,
                    resource_type=l.resource_type,
                    resource_id=str(l.resource_id) if l.resource_id else None,
                    user_id=str(l.user_id) if l.user_id else None,
                    created_at=l.created_at,
                )
            )

    return DashboardResponse(
        total_projects=total_projects,
        open_issues=open_issues,
        completed_issues=completed_issues,
        active_sprint=active_sprint,
        sprint_progress=sprint_progress,
        issues_by_status=[
            StatusCount(status=s, count=c) for s, c in issues_by_status.items()
        ],
        issues_by_priority=[
            PriorityCount(priority=p, count=c) for p, c in issues_by_priority.items()
        ],
        recent_activity=recent_activity,
    )
