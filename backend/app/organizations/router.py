from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import MessageResponse, UserPublic
from app.core.cache import cache_delete, cache_get, cache_set
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.enums import MemberRole
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.permissions import require_org_member, require_org_role
from app.core.redis import get_redis
from app.organizations.models import Organization, OrganizationMember, generate_invite_code
from app.organizations.schemas import (
    OrgCreate,
    OrgDetailResponse,
    OrgInviteCodeResponse,
    OrgJoinRequest,
    OrgMemberAdd,
    OrgMemberResponse,
    OrgMemberUpdateRole,
    OrgResponse,
    OrgUpdate,
)
from app.users.models import User

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.post("", response_model=OrgResponse, status_code=201)
async def create_organization(
    body: OrgCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> OrgResponse:
    existing = await db.execute(select(Organization).where(Organization.slug == body.slug))
    if existing.scalar_one_or_none():
        raise ConflictError("Organization slug already taken")

    org = Organization(
        name=body.name,
        slug=body.slug,
        description=body.description,
        owner_id=current_user.id,
    )
    db.add(org)
    await db.flush()

    # Add creator as ADMIN member
    member = OrganizationMember(
        organization_id=org.id,
        user_id=current_user.id,
        role=MemberRole.ADMIN,
    )
    db.add(member)

    return OrgResponse(
        id=str(org.id),
        name=org.name,
        slug=org.slug,
        description=org.description,
        owner_id=str(org.owner_id),
        invite_code=org.invite_code,
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


@router.post("/join", response_model=OrgResponse)
async def join_organization_with_code(
    body: OrgJoinRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> OrgResponse:
    clean_code = body.code.strip().upper()
    result = await db.execute(select(Organization).where(Organization.invite_code == clean_code))
    org = result.scalar_one_or_none()
    if not org:
        raise NotFoundError("Organization with code", clean_code)

    # Check if already a member
    mem_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    if mem_res.scalar_one_or_none():
        raise ConflictError("You are already a member of this organization")

    # Add as DEVELOPER member
    member = OrganizationMember(
        organization_id=org.id,
        user_id=current_user.id,
        role=MemberRole.DEVELOPER,
    )
    db.add(member)
    await db.flush()

    # Invalidate cache
    r = await get_redis()
    await cache_delete(r, f"org:{org.id}")

    return OrgResponse(
        id=str(org.id),
        name=org.name,
        slug=org.slug,
        description=org.description,
        owner_id=str(org.owner_id),
        invite_code=org.invite_code,
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


@router.get("", response_model=list[OrgResponse])
async def list_user_organizations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[OrgResponse]:
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember)
        .where(OrganizationMember.user_id == current_user.id)
    )
    orgs = result.scalars().all()
    for o in orgs:
        if not o.invite_code:
            o.invite_code = generate_invite_code()
    await db.flush()

    return [
        OrgResponse(
            id=str(o.id),
            name=o.name,
            slug=o.slug,
            description=o.description,
            owner_id=str(o.owner_id),
            invite_code=o.invite_code,
            created_at=o.created_at,
            updated_at=o.updated_at,
        )
        for o in orgs
    ]


@router.get("/{org_id}", response_model=OrgDetailResponse)
async def get_organization(
    org_and_member: tuple[Organization, OrganizationMember] = Depends(require_org_member),
    db: AsyncSession = Depends(get_db),
) -> OrgDetailResponse:
    org, _ = org_and_member

    if not org.invite_code:
        org.invite_code = generate_invite_code()
        await db.flush()

    # Check Redis cache first
    r = await get_redis()
    cache_key = f"org:{org.id}"
    cached = await cache_get(r, cache_key)
    if cached:
        return OrgDetailResponse(**cached)

    count_res = await db.execute(
        select(func.count(OrganizationMember.id)).where(
            OrganizationMember.organization_id == org.id
        )
    )
    count = count_res.scalar() or 0

    result = OrgDetailResponse(
        id=str(org.id),
        name=org.name,
        slug=org.slug,
        description=org.description,
        owner_id=str(org.owner_id),
        invite_code=org.invite_code,
        created_at=org.created_at,
        updated_at=org.updated_at,
        member_count=count,
    )

    await cache_set(r, cache_key, result.model_dump(mode="json"), ttl=300)

    return result


@router.patch("/{org_id}", response_model=OrgResponse)
async def update_organization(
    body: OrgUpdate,
    org_and_member: tuple[Organization, OrganizationMember] = Depends(
        require_org_role([MemberRole.ADMIN, MemberRole.PROJECT_MANAGER])
    ),
    db: AsyncSession = Depends(get_db),
) -> OrgResponse:
    org, _ = org_and_member
    if body.name is not None:
        org.name = body.name
    if body.description is not None:
        org.description = body.description

    # Invalidate cache
    r = await get_redis()
    await cache_delete(r, f"org:{org.id}")

    return OrgResponse(
        id=str(org.id),
        name=org.name,
        slug=org.slug,
        description=org.description,
        owner_id=str(org.owner_id),
        invite_code=org.invite_code,
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


@router.delete("/{org_id}", response_model=MessageResponse)
async def delete_organization(
    org_and_member: tuple[Organization, OrganizationMember] = Depends(
        require_org_role([MemberRole.ADMIN])
    ),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    org, _ = org_and_member

    # Invalidate cache
    r = await get_redis()
    await cache_delete(r, f"org:{org.id}")

    await db.delete(org)
    await db.commit()

    return MessageResponse(message=f"Organization '{org.name}' successfully deleted")


@router.get("/{org_id}/invite-code", response_model=OrgInviteCodeResponse)
async def get_org_invite_code(
    org_and_member: tuple[Organization, OrganizationMember] = Depends(require_org_member),
    db: AsyncSession = Depends(get_db),
) -> OrgInviteCodeResponse:
    org, _ = org_and_member
    if not org.invite_code:
        org.invite_code = generate_invite_code()
        await db.flush()
    return OrgInviteCodeResponse(invite_code=org.invite_code)


@router.post("/{org_id}/regenerate-invite-code", response_model=OrgInviteCodeResponse)
async def regenerate_org_invite_code(
    org_and_member: tuple[Organization, OrganizationMember] = Depends(
        require_org_role([MemberRole.ADMIN])
    ),
    db: AsyncSession = Depends(get_db),
) -> OrgInviteCodeResponse:
    org, _ = org_and_member
    org.invite_code = generate_invite_code()
    await db.flush()

    # Invalidate org cache
    r = await get_redis()
    await cache_delete(r, f"org:{org.id}")

    return OrgInviteCodeResponse(invite_code=org.invite_code)


# Members management
@router.get("/{org_id}/members", response_model=list[OrgMemberResponse])
async def list_org_members(
    org_and_member: tuple[Organization, OrganizationMember] = Depends(require_org_member),
    db: AsyncSession = Depends(get_db),
) -> list[OrgMemberResponse]:
    org, _ = org_and_member
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == org.id)
    )
    items = result.all()
    return [
        OrgMemberResponse(
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
        for m, u in items
    ]


@router.post("/{org_id}/members", response_model=OrgMemberResponse, status_code=201)
async def add_org_member(
    body: OrgMemberAdd,
    org_and_member: tuple[Organization, OrganizationMember] = Depends(
        require_org_role([MemberRole.ADMIN])
    ),
    db: AsyncSession = Depends(get_db),
) -> OrgMemberResponse:
    org, _ = org_and_member

    try:
        target_user_id = uuid.UUID(body.user_id)
    except ValueError:
        raise NotFoundError("User", body.user_id)

    user_res = await db.execute(select(User).where(User.id == target_user_id))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise NotFoundError("User", body.user_id)

    existing = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == target_user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("User is already a member of this organization")

    member = OrganizationMember(
        organization_id=org.id,
        user_id=target_user_id,
        role=body.role,
    )
    db.add(member)
    await db.flush()

    # Invalidate org cache
    r = await get_redis()
    await cache_delete(r, f"org:{org.id}")

    return OrgMemberResponse(
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


@router.delete("/{org_id}/members/{user_id}", response_model=MessageResponse)
async def remove_org_member(
    user_id: str,
    org_and_member: tuple[Organization, OrganizationMember] = Depends(
        require_org_role([MemberRole.ADMIN])
    ),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    org, current_mem = org_and_member

    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise NotFoundError("User", user_id)

    if target_uuid == org.owner_id:
        raise ForbiddenError("Cannot remove organization owner")

    res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == target_uuid,
        )
    )
    target_member = res.scalar_one_or_none()
    if not target_member:
        raise NotFoundError("OrganizationMember", user_id)

    await db.delete(target_member)

    # Invalidate org cache
    r = await get_redis()
    await cache_delete(r, f"org:{org.id}")

    return MessageResponse(message="Member removed successfully")
