from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import MessageResponse, UserPublic
from app.core.cache import cache_delete, cache_get, cache_set
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.enums import MemberRole
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.permissions import require_org_member, require_org_role, require_project_member
from app.core.redis import get_redis
from app.organizations.models import Organization, OrganizationMember
from app.projects.models import Project, ProjectMember
from app.projects.schemas import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.users.models import User

router = APIRouter(tags=["Projects"])


@router.post("/organizations/{org_id}/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    org_id: str,
    body: ProjectCreate,
    org_and_member: tuple[Organization, OrganizationMember] = Depends(
        require_org_role([MemberRole.ADMIN, MemberRole.PROJECT_MANAGER])
    ),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    org, _ = org_and_member

    existing = await db.execute(
        select(Project).where(
            Project.organization_id == org.id,
            Project.key == body.key,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError(f"Project key '{body.key}' already exists in this organization")

    project = Project(
        name=body.name,
        key=body.key.upper(),
        description=body.description,
        organization_id=org.id,
        owner_id=current_user.id,
    )
    db.add(project)
    await db.flush()

    # Add creator as ADMIN project member
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=MemberRole.ADMIN,
    )
    db.add(member)

    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        key=project.key,
        description=project.description,
        organization_id=str(project.organization_id),
        owner_id=str(project.owner_id),
        is_archived=project.is_archived,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/organizations/{org_id}/projects", response_model=list[ProjectResponse])
async def list_org_projects(
    org_id: str,
    org_and_member: tuple[Organization, OrganizationMember] = Depends(require_org_member),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    org, org_member = org_and_member

    if org_member.role == MemberRole.ADMIN:
        # Admins see all org projects
        result = await db.execute(
            select(Project).where(Project.organization_id == org.id)
        )
    else:
        # Non-admins see projects they belong to
        result = await db.execute(
            select(Project)
            .join(ProjectMember)
            .where(
                Project.organization_id == org.id,
                ProjectMember.user_id == current_user.id,
            )
        )

    projects = result.scalars().all()
    return [
        ProjectResponse(
            id=str(p.id),
            name=p.name,
            key=p.key,
            description=p.description,
            organization_id=str(p.organization_id),
            owner_id=str(p.owner_id),
            is_archived=p.is_archived,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in projects
    ]


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
) -> ProjectResponse:
    project, _ = proj_and_member

    r = await get_redis()
    cache_key = f"project:{project.id}"
    cached = await cache_get(r, cache_key)
    if cached:
        return ProjectResponse(**cached)

    result = ProjectResponse(
        id=str(project.id),
        name=project.name,
        key=project.key,
        description=project.description,
        organization_id=str(project.organization_id),
        owner_id=str(project.owner_id),
        is_archived=project.is_archived,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )

    await cache_set(r, cache_key, result.model_dump(mode="json"), ttl=300)
    return result


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    body: ProjectUpdate,
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    project, pmember = proj_and_member

    if pmember.role not in (MemberRole.ADMIN, MemberRole.PROJECT_MANAGER):
        raise ForbiddenError("Only ADMIN or PROJECT_MANAGER can update project details")

    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description

    # Invalidate cache
    r = await get_redis()
    await cache_delete(r, f"project:{project.id}")

    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        key=project.key,
        description=project.description,
        organization_id=str(project.organization_id),
        owner_id=str(project.owner_id),
        is_archived=project.is_archived,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.post("/projects/{project_id}/archive", response_model=ProjectResponse)
async def archive_project(
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    project, pmember = proj_and_member

    if pmember.role != MemberRole.ADMIN:
        raise ForbiddenError("Only project ADMIN can archive project")

    project.is_archived = True

    # Invalidate cache
    r = await get_redis()
    await cache_delete(r, f"project:{project.id}")

    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        key=project.key,
        description=project.description,
        organization_id=str(project.organization_id),
        owner_id=str(project.owner_id),
        is_archived=project.is_archived,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.delete("/projects/{project_id}", response_model=MessageResponse)
async def delete_project(
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    project, pmember = proj_and_member

    if pmember.role != MemberRole.ADMIN:
        raise ForbiddenError("Only project or organization ADMIN can delete project")

    # Invalidate cache
    r = await get_redis()
    await cache_delete(r, f"project:{project.id}")
    await cache_delete(r, f"org:{project.organization_id}:projects")

    await db.delete(project)
    await db.commit()

    return MessageResponse(message=f"Project '{project.name}' successfully deleted")


# Project members management
@router.get("/projects/{project_id}/members", response_model=list[ProjectMemberResponse])
async def list_project_members(
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectMemberResponse]:
    project, _ = proj_and_member

    # 1. Fetch explicit project members
    pm_result = await db.execute(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project.id)
    )
    explicit_items = pm_result.all()
    explicit_user_ids = {m.user_id: (m, u) for m, u in explicit_items}

    # 2. Fetch all organization members
    om_result = await db.execute(
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == project.organization_id)
    )
    org_items = om_result.all()

    responses: list[ProjectMemberResponse] = []
    seen_users = set()

    # Add explicit project members first
    for m, u in explicit_items:
        seen_users.add(m.user_id)
        responses.append(
            ProjectMemberResponse(
                id=str(m.id),
                user_id=str(m.user_id),
                role=m.role,
                created_at=m.created_at,
                user=UserPublic(
                    id=str(u.id),
                    username=u.username,
                    full_name=u.full_name,
                ),
            )
        )

    # Add any organization members who don't have explicit project role overrides
    for om, u in org_items:
        if om.user_id not in seen_users:
            seen_users.add(om.user_id)
            responses.append(
                ProjectMemberResponse(
                    id=str(om.id),
                    user_id=str(om.user_id),
                    role=om.role,
                    created_at=om.created_at,
                    user=UserPublic(
                        id=str(u.id),
                        username=u.username,
                        full_name=u.full_name,
                    ),
                )
            )

    return responses


@router.post("/projects/{project_id}/members", response_model=ProjectMemberResponse, status_code=201)
async def add_project_member(
    body: ProjectMemberAdd,
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
) -> ProjectMemberResponse:
    project, current_pmember = proj_and_member

    if current_pmember.role not in (MemberRole.ADMIN, MemberRole.PROJECT_MANAGER):
        raise ForbiddenError("Only ADMIN or PROJECT_MANAGER can add project members")

    try:
        target_user_id = uuid.UUID(body.user_id)
    except ValueError:
        raise NotFoundError("User", body.user_id)

    # Must verify target user is part of the parent organization
    org_mem_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == project.organization_id,
            OrganizationMember.user_id == target_user_id,
        )
    )
    if not org_mem_res.scalar_one_or_none():
        raise ForbiddenError("Target user is not a member of the organization")

    user_res = await db.execute(select(User).where(User.id == target_user_id))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise NotFoundError("User", body.user_id)

    existing = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == target_user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("User is already a member of this project")

    member = ProjectMember(
        project_id=project.id,
        user_id=target_user_id,
        role=body.role,
    )
    db.add(member)
    await db.flush()

    return ProjectMemberResponse(
        id=str(member.id),
        user_id=str(member.user_id),
        role=member.role,
        created_at=member.created_at,
        user=UserPublic(
            id=str(target_user.id),
            username=target_user.username,
            full_name=target_user.full_name,
        ),
    )


@router.delete("/projects/{project_id}/members/{user_id}", response_model=MessageResponse)
async def remove_project_member(
    user_id: str,
    proj_and_member: tuple[Project, ProjectMember] = Depends(require_project_member),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    project, current_pmember = proj_and_member

    if current_pmember.role not in (MemberRole.ADMIN, MemberRole.PROJECT_MANAGER):
        raise ForbiddenError("Only ADMIN or PROJECT_MANAGER can remove project members")

    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise NotFoundError("User", user_id)

    if target_uuid == project.owner_id:
        raise ForbiddenError("Cannot remove project owner")

    res = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == target_uuid,
        )
    )
    target_member = res.scalar_one_or_none()
    if not target_member:
        raise NotFoundError("ProjectMember", user_id)

    await db.delete(target_member)
    return MessageResponse(message="Member removed successfully")
