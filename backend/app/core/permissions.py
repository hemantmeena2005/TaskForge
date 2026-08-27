from __future__ import annotations

import uuid

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.enums import MemberRole
from app.core.exceptions import ForbiddenError, NotFoundError
from app.organizations.models import Organization, OrganizationMember
from app.projects.models import Project, ProjectMember
from app.users.models import User


async def get_org_member(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> OrganizationMember | None:
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def require_org_member(
    org_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[Organization, OrganizationMember]:
    try:
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        raise NotFoundError("Organization", org_id)

    org_res = await db.execute(select(Organization).where(Organization.id == org_uuid))
    org = org_res.scalar_one_or_none()
    if not org:
        raise NotFoundError("Organization", org_id)

    member = await get_org_member(org_uuid, current_user.id, db)
    if not member:
        raise ForbiddenError("You are not a member of this organization")

    return org, member


def require_org_role(allowed_roles: list[MemberRole]):
    async def dependency(
        org_and_member: tuple[Organization, OrganizationMember] = Depends(require_org_member),
    ) -> tuple[Organization, OrganizationMember]:
        org, member = org_and_member
        if member.role not in allowed_roles:
            raise ForbiddenError(
                f"Action requires one of roles: {[r.value for r in allowed_roles]}"
            )
        return org, member

    return dependency


async def require_project_member(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[Project, ProjectMember]:
    try:
        proj_uuid = uuid.UUID(project_id)
    except ValueError:
        raise NotFoundError("Project", project_id)

    proj_res = await db.execute(select(Project).where(Project.id == proj_uuid))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise NotFoundError("Project", project_id)

    # First verify user belongs to parent org
    org_member = await get_org_member(project.organization_id, current_user.id, db)
    if not org_member:
        raise ForbiddenError("You are not a member of this organization")

    # Then check project member
    pm_res = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == proj_uuid,
            ProjectMember.user_id == current_user.id,
        )
    )
    pmember = pm_res.scalar_one_or_none()
    if not pmember:
        # All members of the parent organization inherit their org role on projects
        pmember = ProjectMember(
            id=uuid.uuid4(),
            project_id=project.id,
            user_id=current_user.id,
            role=org_member.role,
        )

    return project, pmember
