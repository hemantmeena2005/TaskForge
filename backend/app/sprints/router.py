from __future__ import annotations
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.schemas import MessageResponse
from app.core.audit_service import create_audit_log
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.enums import AuditAction, IssueStatus, MemberRole, SprintStatus
from app.core.events import DomainEvent, EventType
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.kafka_producer import publish_event
from app.core.notification_service import create_notification
from app.core.permissions import require_project_member
from app.core.enums import NotificationType
from app.issues.models import Issue
from app.projects.models import Project, ProjectMember
from app.sprints.models import Sprint
from app.sprints.schemas import (
    BurndownPoint,
    CompleteSprintRequest,
    SprintAddIssuesRequest,
    SprintCreate,
    SprintResponse,
    SprintStatsResponse,
    SprintUpdate,
)
from app.users.models import User

router = APIRouter(tags=["Sprints"])


@router.post("/projects/{project_id}/sprints", response_model=SprintResponse, status_code=201)
async def create_sprint(
    project_id: str,
    body: SprintCreate,
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
) -> SprintResponse:
    project, pmember = proj_and_member

    if pmember.role not in (MemberRole.ADMIN, MemberRole.PROJECT_MANAGER):
        raise ForbiddenError("Only ADMIN or PROJECT_MANAGER can create sprints")

    sprint = Sprint(
        project_id=project.id,
        name=body.name,
        goal=body.goal,
        start_date=body.start_date,
        end_date=body.end_date,
        status=SprintStatus.PLANNED,
    )
    db.add(sprint)
    await db.flush()
    await db.refresh(sprint)

    return _format_sprint_response(sprint, 0)


@router.get("/projects/{project_id}/sprints", response_model=list[SprintResponse])
async def list_project_sprints(
    project_id: str,
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    status: SprintStatus = Query(None, description="Filter by sprint status"),
    db: AsyncSession = Depends(get_db),
) -> list[SprintResponse]:
    project, _ = proj_and_member

    query = select(Sprint).where(Sprint.project_id == project.id)
    if status:
        query = query.where(Sprint.status == status)

    query = query.order_by(Sprint.created_at.desc())
    res = await db.execute(query)
    sprints = res.scalars().all()

    response = []
    for s in sprints:
        count_res = await db.execute(
            select(func.count(Issue.id)).where(Issue.sprint_id == s.id)
        )
        count = count_res.scalar() or 0
        response.append(_format_sprint_response(s, count))

    return response


@router.get("/sprints/{sprint_id}", response_model=SprintResponse)
async def get_sprint(
    sprint_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SprintResponse:
    try:
        sprint_uuid = uuid.UUID(sprint_id)
    except ValueError:
        raise NotFoundError("Sprint", sprint_id)

    res = await db.execute(select(Sprint).where(Sprint.id == sprint_uuid))
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise NotFoundError("Sprint", sprint_id)

    await require_project_member(str(sprint.project_id), current_user, db)

    count_res = await db.execute(
        select(func.count(Issue.id)).where(Issue.sprint_id == sprint.id)
    )
    count = count_res.scalar() or 0

    return _format_sprint_response(sprint, count)


@router.patch("/sprints/{sprint_id}", response_model=SprintResponse)
async def update_sprint(
    sprint_id: str,
    body: SprintUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SprintResponse:
    try:
        sprint_uuid = uuid.UUID(sprint_id)
    except ValueError:
        raise NotFoundError("Sprint", sprint_id)

    res = await db.execute(select(Sprint).where(Sprint.id == sprint_uuid))
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise NotFoundError("Sprint", sprint_id)

    _, pmember = await require_project_member(str(sprint.project_id), current_user, db)
    if pmember.role not in (MemberRole.ADMIN, MemberRole.PROJECT_MANAGER):
        raise ForbiddenError("Only ADMIN or PROJECT_MANAGER can update sprints")

    if body.name is not None:
        sprint.name = body.name
    if body.goal is not None:
        sprint.goal = body.goal
    if body.start_date is not None:
        sprint.start_date = body.start_date
    if body.end_date is not None:
        sprint.end_date = body.end_date

    await db.flush()
    await db.refresh(sprint)

    count_res = await db.execute(
        select(func.count(Issue.id)).where(Issue.sprint_id == sprint.id)
    )
    count = count_res.scalar() or 0

    return _format_sprint_response(sprint, count)


@router.post("/sprints/{sprint_id}/start", response_model=SprintResponse)
async def start_sprint(
    sprint_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SprintResponse:
    try:
        sprint_uuid = uuid.UUID(sprint_id)
    except ValueError:
        raise NotFoundError("Sprint", sprint_id)

    res = await db.execute(select(Sprint).where(Sprint.id == sprint_uuid))
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise NotFoundError("Sprint", sprint_id)

    _, pmember = await require_project_member(str(sprint.project_id), current_user, db)
    if pmember.role not in (MemberRole.ADMIN, MemberRole.PROJECT_MANAGER):
        raise ForbiddenError("Only ADMIN or PROJECT_MANAGER can start sprints")

    if sprint.status == SprintStatus.ACTIVE:
        raise ConflictError("Sprint is already active")
    if sprint.status == SprintStatus.COMPLETED:
        raise ConflictError("Cannot start a completed sprint")

    # Check no other active sprint exists in project
    active_res = await db.execute(
        select(Sprint).where(
            Sprint.project_id == sprint.project_id,
            Sprint.status == SprintStatus.ACTIVE,
        )
    )
    if active_res.scalar_one_or_none():
        raise ConflictError("Project already has an active sprint. Complete it before starting a new sprint.")

    sprint.status = SprintStatus.ACTIVE
    if not sprint.start_date:
        sprint.start_date = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(sprint)

    # Audit log
    await create_audit_log(
        db, user_id=current_user.id, action=AuditAction.SPRINT_STARTED,
        resource_type="sprint", resource_id=sprint.id,
        new_value={"name": sprint.name, "status": "ACTIVE"},
    )

    # Publish Kafka event
    await publish_event(DomainEvent(
        event_type=EventType.SPRINT_STARTED,
        user_id=str(current_user.id),
        resource_type="sprint",
        resource_id=str(sprint.id),
        data={"name": sprint.name, "project_id": str(sprint.project_id)},
    ))

    count_res = await db.execute(
        select(func.count(Issue.id)).where(Issue.sprint_id == sprint.id)
    )
    count = count_res.scalar() or 0

    return _format_sprint_response(sprint, count)


@router.post("/sprints/{sprint_id}/complete", response_model=SprintResponse)
async def complete_sprint(
    sprint_id: str,
    body: CompleteSprintRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SprintResponse:
    try:
        sprint_uuid = uuid.UUID(sprint_id)
    except ValueError:
        raise NotFoundError("Sprint", sprint_id)

    res = await db.execute(select(Sprint).where(Sprint.id == sprint_uuid))
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise NotFoundError("Sprint", sprint_id)

    _, pmember = await require_project_member(str(sprint.project_id), current_user, db)
    if pmember.role not in (MemberRole.ADMIN, MemberRole.PROJECT_MANAGER):
        raise ForbiddenError("Only ADMIN or PROJECT_MANAGER can complete sprints")

    if sprint.status != SprintStatus.ACTIVE:
        raise ConflictError("Only active sprints can be completed")

    # Check destination sprint if provided
    dest_sprint_uuid: uuid.UUID | None = None
    if body.destination_sprint_id:
        try:
            dest_sprint_uuid = uuid.UUID(body.destination_sprint_id)
        except ValueError:
            raise NotFoundError("Sprint", body.destination_sprint_id)

        dest_res = await db.execute(select(Sprint).where(Sprint.id == dest_sprint_uuid))
        dest_sprint = dest_res.scalar_one_or_none()
        if not dest_sprint or dest_sprint.project_id != sprint.project_id:
            raise NotFoundError("Destination Sprint", body.destination_sprint_id)

    # Move unfinished issues (status != DONE)
    unfinished_res = await db.execute(
        select(Issue).where(
            Issue.sprint_id == sprint.id,
            Issue.status != IssueStatus.DONE,
        )
    )
    unfinished_issues = unfinished_res.scalars().all()
    for issue in unfinished_issues:
        issue.sprint_id = dest_sprint_uuid

    sprint.status = SprintStatus.COMPLETED
    sprint.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(sprint)

    # Audit log
    await create_audit_log(
        db, user_id=current_user.id, action=AuditAction.SPRINT_COMPLETED,
        resource_type="sprint", resource_id=sprint.id,
        new_value={"name": sprint.name, "status": "COMPLETED", "moved_issues": len(unfinished_issues)},
    )

    # Publish Kafka event
    await publish_event(DomainEvent(
        event_type=EventType.SPRINT_COMPLETED,
        user_id=str(current_user.id),
        resource_type="sprint",
        resource_id=str(sprint.id),
        data={"name": sprint.name, "moved_issues": len(unfinished_issues)},
    ))

    count_res = await db.execute(
        select(func.count(Issue.id)).where(Issue.sprint_id == sprint.id)
    )
    count = count_res.scalar() or 0

    return _format_sprint_response(sprint, count)


@router.post("/sprints/{sprint_id}/issues", response_model=MessageResponse)
async def add_issues_to_sprint(
    sprint_id: str,
    body: SprintAddIssuesRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    try:
        sprint_uuid = uuid.UUID(sprint_id)
    except ValueError:
        raise NotFoundError("Sprint", sprint_id)

    res = await db.execute(select(Sprint).where(Sprint.id == sprint_uuid))
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise NotFoundError("Sprint", sprint_id)

    _, pmember = await require_project_member(str(sprint.project_id), current_user, db)
    if pmember.role == MemberRole.VIEWER:
        raise ForbiddenError("VIEWER role cannot modify sprints")

    issue_uuids = [uuid.UUID(iid) for iid in body.issue_ids]
    issues_res = await db.execute(
        select(Issue).where(
            Issue.id.in_(issue_uuids),
            Issue.project_id == sprint.project_id,
        )
    )
    issues = issues_res.scalars().all()
    for issue in issues:
        issue.sprint_id = sprint.id

    return MessageResponse(message=f"Added {len(issues)} issues to sprint '{sprint.name}'")


@router.delete("/sprints/{sprint_id}/issues/{issue_id}", response_model=MessageResponse)
async def remove_issue_from_sprint(
    sprint_id: str,
    issue_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    try:
        sprint_uuid = uuid.UUID(sprint_id)
        issue_uuid = uuid.UUID(issue_id)
    except ValueError:
        raise NotFoundError("Resource", issue_id)

    res = await db.execute(select(Sprint).where(Sprint.id == sprint_uuid))
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise NotFoundError("Sprint", sprint_id)

    _, pmember = await require_project_member(str(sprint.project_id), current_user, db)
    if pmember.role == MemberRole.VIEWER:
        raise ForbiddenError("VIEWER role cannot modify sprints")

    iss_res = await db.execute(
        select(Issue).where(
            Issue.id == issue_uuid,
            Issue.sprint_id == sprint.id,
        )
    )
    issue = iss_res.scalar_one_or_none()
    if not issue:
        raise NotFoundError("Issue", issue_id)

    issue.sprint_id = None
    return MessageResponse(message="Issue removed from sprint")


@router.get("/sprints/{sprint_id}/stats", response_model=SprintStatsResponse)
async def get_sprint_stats(
    sprint_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SprintStatsResponse:
    try:
        sprint_uuid = uuid.UUID(sprint_id)
    except ValueError:
        raise NotFoundError("Sprint", sprint_id)

    res = await db.execute(select(Sprint).where(Sprint.id == sprint_uuid))
    sprint = res.scalar_one_or_none()
    if not sprint:
        raise NotFoundError("Sprint", sprint_id)

    await require_project_member(str(sprint.project_id), current_user, db)

    issues_res = await db.execute(select(Issue).where(Issue.sprint_id == sprint.id))
    issues = issues_res.scalars().all()

    total = len(issues)
    completed = sum(1 for i in issues if i.status == IssueStatus.DONE)
    remaining = total - completed
    pct = round((completed / total * 100.0), 1) if total > 0 else 0.0

    # Calculate burndown points (simplified 7-point burndown simulation based on dates)
    burndown_points: list[BurndownPoint] = []
    days_count = 7
    rem_acc = total
    comp_acc = 0
    for day_idx in range(days_count):
        day_str = f"Day {day_idx + 1}"
        # Linear burndown estimate
        burndown_points.append(
            BurndownPoint(
                day=day_str,
                remaining_issues=max(0, total - int((completed / max(1, days_count - 1)) * day_idx)),
                completed_issues=min(completed, int((completed / max(1, days_count - 1)) * day_idx)),
            )
        )

    return SprintStatsResponse(
        sprint_id=str(sprint.id),
        total_issues=total,
        completed_issues=completed,
        remaining_issues=remaining,
        completion_percentage=pct,
        burndown=burndown_points,
    )


def _format_sprint_response(sprint: Sprint, issue_count: int) -> SprintResponse:
    return SprintResponse(
        id=str(sprint.id),
        project_id=str(sprint.project_id),
        name=sprint.name,
        goal=sprint.goal,
        status=sprint.status,
        start_date=sprint.start_date,
        end_date=sprint.end_date,
        completed_at=sprint.completed_at,
        issue_count=issue_count,
        created_at=sprint.created_at,
        updated_at=sprint.updated_at,
    )
