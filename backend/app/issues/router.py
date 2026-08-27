from __future__ import annotations

import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.schemas import MessageResponse, UserPublic
from app.core.audit_service import create_audit_log
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.enums import AuditAction, IssuePriority, IssueStatus, IssueType, MemberRole, NotificationType
from app.core.events import DomainEvent, EventType
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.kafka_producer import publish_event
from app.core.notification_service import create_notification
from app.core.permissions import require_org_member, require_org_role, require_project_member
from app.issues.models import Issue, Label, issue_labels
from app.issues.schemas import (
    BoardColumnResponse,
    BoardResponse,
    IssueAssign,
    IssueCreate,
    IssueListResponse,
    IssueMoveRequest,
    IssuePriorityUpdate,
    IssueResponse,
    IssueStatusUpdate,
    IssueUpdate,
    LabelCreate,
    LabelResponse,
    PaginationMeta,
)
from app.organizations.models import Organization, OrganizationMember
from app.projects.models import Project, ProjectMember
from app.users.models import User

router = APIRouter(tags=["Issues & Labels"])


# Labels endpoints
@router.post("/organizations/{org_id}/labels", response_model=LabelResponse, status_code=201)
async def create_label(
    org_id: str,
    body: LabelCreate,
    org_and_member: tuple[Organization, OrganizationMember] = Depends(
        require_org_role([MemberRole.ADMIN, MemberRole.PROJECT_MANAGER, MemberRole.DEVELOPER])
    ),
    db: AsyncSession = Depends(get_db),
) -> LabelResponse:
    org, _ = org_and_member

    existing = await db.execute(
        select(Label).where(Label.organization_id == org.id, Label.name == body.name)
    )
    if existing.scalar_one_or_none():
        raise ConflictError(f"Label '{body.name}' already exists in this organization")

    label = Label(
        organization_id=org.id,
        name=body.name,
        color=body.color,
    )
    db.add(label)
    await db.flush()

    return LabelResponse(
        id=str(label.id),
        organization_id=str(label.organization_id),
        name=label.name,
        color=label.color,
        created_at=label.created_at,
    )


@router.get("/organizations/{org_id}/labels", response_model=list[LabelResponse])
async def list_labels(
    org_id: str,
    org_and_member: tuple[Organization, OrganizationMember] = Depends(require_org_member),
    db: AsyncSession = Depends(get_db),
) -> list[LabelResponse]:
    org, _ = org_and_member
    result = await db.execute(
        select(Label).where(Label.organization_id == org.id).order_by(Label.name)
    )
    labels = result.scalars().all()
    return [
        LabelResponse(
            id=str(l.id),
            organization_id=str(l.organization_id),
            name=l.name,
            color=l.color,
            created_at=l.created_at,
        )
        for l in labels
    ]


# Issues endpoints
@router.post("/projects/{project_id}/issues", response_model=IssueResponse, status_code=201)
async def create_issue(
    project_id: str,
    body: IssueCreate,
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> IssueResponse:
    project, current_pmember = proj_and_member

    if current_pmember.role == MemberRole.VIEWER:
        raise ForbiddenError("VIEWER role cannot create issues")

    # Validate assignee if provided
    assignee_uuid: uuid.UUID | None = None
    if body.assignee_id:
        try:
            assignee_uuid = uuid.UUID(body.assignee_id)
        except ValueError:
            raise NotFoundError("User", body.assignee_id)

        om_res = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == project.organization_id,
                OrganizationMember.user_id == assignee_uuid,
            )
        )
        if not om_res.scalar_one_or_none():
            raise ForbiddenError("Assignee must be a member of this organization")

    # Compute next issue number atomically for this project
    num_res = await db.execute(
        select(func.coalesce(func.max(Issue.issue_number), 0)).where(
            Issue.project_id == project.id
        )
    )
    next_num = (num_res.scalar() or 0) + 1
    issue_key = f"{project.key}-{next_num}"

    sprint_uuid = uuid.UUID(body.sprint_id) if body.sprint_id else None

    labels_list: list[Label] = []
    if body.label_ids:
        lbl_uuids = [uuid.UUID(lid) for lid in body.label_ids]
        lbl_res = await db.execute(
            select(Label).where(
                Label.id.in_(lbl_uuids),
                Label.organization_id == project.organization_id,
            )
        )
        labels_list = list(lbl_res.scalars().all())

    issue = Issue(
        issue_number=next_num,
        issue_key=issue_key,
        title=body.title,
        description=body.description,
        type=body.type,
        priority=body.priority,
        status=body.status,
        project_id=project.id,
        reporter_id=current_user.id,
        assignee_id=assignee_uuid,
        sprint_id=sprint_uuid,
        due_date=body.due_date,
        labels=labels_list,
    )
    db.add(issue)
    await db.flush()
    await db.refresh(issue)

    # Audit log
    await create_audit_log(
        db, user_id=current_user.id, action=AuditAction.ISSUE_CREATED,
        resource_type="issue", resource_id=issue.id,
        new_value={"issue_key": issue_key, "title": issue.title, "status": str(issue.status.value)},
    )

    # Notification to assignee
    if assignee_uuid and assignee_uuid != current_user.id:
        await create_notification(
            db, user_id=assignee_uuid, type=NotificationType.ISSUE_ASSIGNED,
            title=f"You were assigned to {issue_key}",
            message=f"{current_user.username} assigned you to '{issue.title}'",
            reference_type="issue", reference_id=issue.id,
        )

    # Publish Kafka event
    await publish_event(DomainEvent(
        event_type=EventType.ISSUE_CREATED,
        user_id=str(current_user.id),
        resource_type="issue",
        resource_id=str(issue.id),
        data={"issue_key": issue_key, "title": issue.title, "priority": str(issue.priority.value)},
    ))

    return await _format_issue_response(issue, db)


@router.get("/issues/assigned-to-me", response_model=list[IssueResponse])
async def list_my_assigned_issues(
    priority: Optional[IssuePriority] = Query(None),
    status: Optional[IssueStatus] = Query(None),
    type: Optional[IssueType] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[IssueResponse]:
    query = (
        select(Issue)
        .options(selectinload(Issue.labels))
        .where(Issue.assignee_id == current_user.id)
    )
    if priority:
        query = query.where(Issue.priority == priority)
    if status:
        query = query.where(Issue.status == status)
    if type:
        query = query.where(Issue.type == type)
    if search and search.strip():
        term = search.strip().lstrip("@")
        pattern = f"%{term}%"
        query = query.where(
            or_(
                Issue.title.ilike(pattern),
                Issue.description.ilike(pattern),
                Issue.issue_key.ilike(pattern),
            )
        )
    query = query.order_by(Issue.created_at.desc())
    res = await db.execute(query)
    issues = res.scalars().all()
    return [await _format_issue_response(iss, db) for iss in issues]


@router.get("/projects/{project_id}/issues", response_model=IssueListResponse)
async def list_issues(
    project_id: str,
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    status: Optional[IssueStatus] = Query(None),
    priority: Optional[IssuePriority] = Query(None),
    type: Optional[IssueType] = Query(None),
    assignee_id: Optional[str] = Query(None),
    sprint_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at", pattern=r"^(created_at|updated_at|priority|due_date|issue_number)$"),
    order: str = Query("desc", pattern=r"^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> IssueListResponse:
    project, _ = proj_and_member

    query = (
        select(Issue)
        .options(selectinload(Issue.labels))
        .where(Issue.project_id == project.id)
    )

    if status:
        query = query.where(Issue.status == status)
    if priority:
        query = query.where(Issue.priority == priority)
    if type:
        query = query.where(Issue.type == type)
    if assignee_id:
        if assignee_id == "me":
            query = query.where(Issue.assignee_id == current_user.id)
        else:
            try:
                query = query.where(Issue.assignee_id == uuid.UUID(assignee_id))
            except ValueError:
                pass
    if sprint_id:
        if sprint_id == "backlog" or sprint_id == "none":
            query = query.where(Issue.sprint_id.is_(None))
        else:
            try:
                query = query.where(Issue.sprint_id == uuid.UUID(sprint_id))
            except ValueError:
                pass
    if search and search.strip():
        term = search.strip().lstrip("@")
        pattern = f"%{term}%"
        user_matches = select(User.id).where(
            or_(
                User.username.ilike(pattern),
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
        query = query.where(
            or_(
                Issue.title.ilike(pattern),
                Issue.description.ilike(pattern),
                Issue.issue_key.ilike(pattern),
                Issue.assignee_id.in_(user_matches),
                Issue.reporter_id.in_(user_matches),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    sort_column = getattr(Issue, sort_by)
    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    issues = result.scalars().all()

    items = [await _format_issue_response(issue, db) for issue in issues]
    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    return IssueListResponse(
        items=items,
        meta=PaginationMeta(total=total, page=page, page_size=page_size, total_pages=total_pages),
    )


@router.get("/projects/{project_id}/board", response_model=BoardResponse)
async def get_project_board(
    project_id: str,
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    assignee_id: Optional[str] = Query(None),
    priority: Optional[IssuePriority] = Query(None),
    label_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> BoardResponse:
    project, _ = proj_and_member

    query = (
        select(Issue)
        .options(selectinload(Issue.labels))
        .where(Issue.project_id == project.id)
    )

    if assignee_id:
        try:
            query = query.where(Issue.assignee_id == uuid.UUID(assignee_id))
        except ValueError:
            pass
    if priority:
        query = query.where(Issue.priority == priority)
    if label_id:
        try:
            query = query.join(issue_labels).where(issue_labels.c.label_id == uuid.UUID(label_id))
        except ValueError:
            pass
    if search and search.strip():
        term = search.strip().lstrip("@")
        pattern = f"%{term}%"
        user_matches = select(User.id).where(
            or_(
                User.username.ilike(pattern),
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
        query = query.where(
            or_(
                Issue.title.ilike(pattern),
                Issue.description.ilike(pattern),
                Issue.issue_key.ilike(pattern),
                Issue.assignee_id.in_(user_matches),
                Issue.reporter_id.in_(user_matches),
            )
        )

    res = await db.execute(query.order_by(Issue.created_at.desc()))
    all_issues = res.scalars().all()

    status_map: dict[IssueStatus, list[Issue]] = {
        IssueStatus.TODO: [], IssueStatus.IN_PROGRESS: [],
        IssueStatus.IN_REVIEW: [], IssueStatus.DONE: [],
    }
    for issue in all_issues:
        if issue.status in status_map:
            status_map[issue.status].append(issue)

    columns = []
    for st in [IssueStatus.TODO, IssueStatus.IN_PROGRESS, IssueStatus.IN_REVIEW, IssueStatus.DONE]:
        formatted_list = [await _format_issue_response(iss, db) for iss in status_map[st]]
        columns.append(BoardColumnResponse(status=st, issues=formatted_list, total_count=len(formatted_list)))

    return BoardResponse(project_id=str(project.id), columns=columns)


@router.post("/issues/{issue_id}/move", response_model=IssueResponse)
@router.patch("/issues/{issue_id}/move", response_model=IssueResponse)
async def move_issue_status(
    issue_id: str,
    body: IssueMoveRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> IssueResponse:
    try:
        issue_uuid = uuid.UUID(issue_id)
    except ValueError:
        raise NotFoundError("Issue", issue_id)

    res = await db.execute(
        select(Issue).options(selectinload(Issue.labels)).where(Issue.id == issue_uuid)
    )
    issue = res.scalar_one_or_none()
    if not issue:
        raise NotFoundError("Issue", issue_id)

    _, pmember = await require_project_member(str(issue.project_id), current_user, db)
    if pmember.role == MemberRole.VIEWER:
        raise ForbiddenError("VIEWER role cannot move issues on the board")

    if issue.version != body.version:
        raise ConflictError(
            f"Conflict: Issue was modified by another user (expected version {body.version}, current version {issue.version}). Please refresh and try again."
        )

    old_status = str(issue.status.value)
    issue.status = body.status
    issue.version += 1
    await db.flush()
    await db.refresh(issue)

    # Audit log
    await create_audit_log(
        db, user_id=current_user.id, action=AuditAction.ISSUE_STATUS_CHANGED,
        resource_type="issue", resource_id=issue.id,
        old_value={"status": old_status}, new_value={"status": str(body.status.value)},
    )

    # Notification to reporter and assignee
    notify_users = set()
    if issue.reporter_id and issue.reporter_id != current_user.id:
        notify_users.add(issue.reporter_id)
    if issue.assignee_id and issue.assignee_id != current_user.id:
        notify_users.add(issue.assignee_id)
    for uid in notify_users:
        await create_notification(
            db, user_id=uid, type=NotificationType.ISSUE_STATUS_CHANGED,
            title=f"{issue.issue_key} status changed",
            message=f"{current_user.username} moved '{issue.title}' to {body.status.value}",
            reference_type="issue", reference_id=issue.id,
        )

    # Publish Kafka event
    await publish_event(DomainEvent(
        event_type=EventType.ISSUE_STATUS_CHANGED,
        user_id=str(current_user.id),
        resource_type="issue",
        resource_id=str(issue.id),
        data={"issue_key": issue.issue_key, "old": old_status, "new": str(body.status.value)},
    ))

    return await _format_issue_response(issue, db)


@router.get("/issues/{issue_id_or_key}", response_model=IssueResponse)
async def get_issue(
    issue_id_or_key: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> IssueResponse:
    query = select(Issue).options(selectinload(Issue.labels))
    try:
        issue_uuid = uuid.UUID(issue_id_or_key)
        query = query.where(Issue.id == issue_uuid)
    except ValueError:
        query = query.where(Issue.issue_key == issue_id_or_key.upper())

    res = await db.execute(query)
    issue = res.scalar_one_or_none()
    if not issue:
        raise NotFoundError("Issue", issue_id_or_key)

    await require_project_member(str(issue.project_id), current_user, db)

    return await _format_issue_response(issue, db)


@router.patch("/issues/{issue_id}", response_model=IssueResponse)
async def update_issue(
    issue_id: str,
    body: IssueUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> IssueResponse:
    try:
        issue_uuid = uuid.UUID(issue_id)
    except ValueError:
        raise NotFoundError("Issue", issue_id)

    res = await db.execute(
        select(Issue).options(selectinload(Issue.labels)).where(Issue.id == issue_uuid)
    )
    issue = res.scalar_one_or_none()
    if not issue:
        raise NotFoundError("Issue", issue_id)

    project, pmember = await require_project_member(str(issue.project_id), current_user, db)
    if pmember.role == MemberRole.VIEWER:
        raise ForbiddenError("VIEWER role cannot update issues")

    changes: dict = {}

    if body.title is not None:
        old_title = issue.title
        issue.title = body.title
        changes["title"] = {"old": old_title, "new": body.title}
    if body.description is not None:
        issue.description = body.description
    if body.type is not None:
        issue.type = body.type
    if body.priority is not None:
        old_priority = str(issue.priority.value)
        issue.priority = body.priority
        changes["priority"] = {"old": old_priority, "new": str(body.priority.value)}
    if body.status is not None:
        old_status = str(issue.status.value)
        issue.status = body.status
        changes["status"] = {"old": old_status, "new": str(body.status.value)}

    if body.assignee_id is not None:
        if body.assignee_id == "":
            old_assignee = str(issue.assignee_id) if issue.assignee_id else None
            issue.assignee_id = None
            changes["assignee"] = {"old": old_assignee, "new": None}
        else:
            try:
                ass_uuid = uuid.UUID(body.assignee_id)
            except ValueError:
                raise NotFoundError("User", body.assignee_id)

            om_res = await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == project.organization_id,
                    OrganizationMember.user_id == ass_uuid,
                )
            )
            if not om_res.scalar_one_or_none():
                raise ForbiddenError("Assignee must be a member of this organization")
            old_assignee = str(issue.assignee_id) if issue.assignee_id else None
            issue.assignee_id = ass_uuid
            changes["assignee"] = {"old": old_assignee, "new": str(ass_uuid)}

    if body.sprint_id is not None:
        issue.sprint_id = uuid.UUID(body.sprint_id) if body.sprint_id else None
    if body.due_date is not None:
        issue.due_date = body.due_date
    if body.label_ids is not None:
        lbl_uuids = [uuid.UUID(lid) for lid in body.label_ids]
        lbl_res = await db.execute(
            select(Label).where(
                Label.id.in_(lbl_uuids),
                Label.organization_id == project.organization_id,
            )
        )
        issue.labels = list(lbl_res.scalars().all())

    issue.version += 1
    await db.flush()
    await db.refresh(issue)

    # Audit log
    if changes:
        await create_audit_log(
            db, user_id=current_user.id, action=AuditAction.ISSUE_UPDATED,
            resource_type="issue", resource_id=issue.id, new_value=changes,
        )

    # Notification for priority changes
    if "priority" in changes:
        notify_users = set()
        if issue.reporter_id and issue.reporter_id != current_user.id:
            notify_users.add(issue.reporter_id)
        if issue.assignee_id and issue.assignee_id != current_user.id:
            notify_users.add(issue.assignee_id)
        for uid in notify_users:
            await create_notification(
                db, user_id=uid, type=NotificationType.ISSUE_PRIORITY_CHANGED,
                title=f"{issue.issue_key} priority changed",
                message=f"{current_user.username} changed priority of '{issue.title}' to {changes['priority']['new']}",
                reference_type="issue", reference_id=issue.id,
            )

    return await _format_issue_response(issue, db)


@router.delete("/issues/{issue_id}", response_model=MessageResponse)
async def delete_issue(
    issue_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    try:
        issue_uuid = uuid.UUID(issue_id)
    except ValueError:
        raise NotFoundError("Issue", issue_id)

    res = await db.execute(select(Issue).where(Issue.id == issue_uuid))
    issue = res.scalar_one_or_none()
    if not issue:
        raise NotFoundError("Issue", issue_id)

    project, pmember = await require_project_member(str(issue.project_id), current_user, db)
    if pmember.role not in (MemberRole.ADMIN, MemberRole.PROJECT_MANAGER):
        raise ForbiddenError("Only ADMIN or PROJECT_MANAGER can delete issues")

    await create_audit_log(
        db, user_id=current_user.id, action=AuditAction.ISSUE_DELETED,
        resource_type="issue", resource_id=issue.id,
        old_value={"issue_key": issue.issue_key, "title": issue.title},
    )

    await db.delete(issue)
    return MessageResponse(message="Issue deleted successfully")


async def _format_issue_response(issue: Issue, db: AsyncSession) -> IssueResponse:
    reporter_res = await db.execute(select(User).where(User.id == issue.reporter_id))
    reporter_user = reporter_res.scalar_one_or_none()

    assignee_user = None
    if issue.assignee_id:
        assignee_res = await db.execute(select(User).where(User.id == issue.assignee_id))
        assignee_user = assignee_res.scalar_one_or_none()

    labels_res = await db.execute(
        select(Label).join(issue_labels).where(issue_labels.c.issue_id == issue.id)
    )
    labels = labels_res.scalars().all()

    return IssueResponse(
        id=str(issue.id),
        issue_number=issue.issue_number,
        issue_key=issue.issue_key,
        title=issue.title,
        description=issue.description,
        type=issue.type,
        priority=issue.priority,
        status=issue.status,
        project_id=str(issue.project_id),
        reporter_id=str(issue.reporter_id),
        assignee_id=str(issue.assignee_id) if issue.assignee_id else None,
        sprint_id=str(issue.sprint_id) if issue.sprint_id else None,
        due_date=issue.due_date,
        version=issue.version,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
        reporter=UserPublic(
            id=str(reporter_user.id), username=reporter_user.username, full_name=reporter_user.full_name,
        ) if reporter_user else None,
        assignee=UserPublic(
            id=str(assignee_user.id), username=assignee_user.username, full_name=assignee_user.full_name,
        ) if assignee_user else None,
        labels=[
            LabelResponse(id=str(l.id), organization_id=str(l.organization_id), name=l.name, color=l.color, created_at=l.created_at)
            for l in labels
        ],
    )
