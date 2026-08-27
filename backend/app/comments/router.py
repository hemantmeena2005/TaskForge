from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import MessageResponse
from app.comments.models import Comment
from app.comments.schemas import CommentCreate, CommentResponse, CommentUpdate
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.enums import MemberRole
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.permissions import require_project_member
from app.issues.models import Issue
from app.projects.models import ProjectMember
from app.users.models import User

router = APIRouter(tags=["Comments"])


@router.get("/issues/{issue_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    issue_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[CommentResponse]:
    try:
        issue_uuid = uuid.UUID(issue_id)
    except ValueError:
        raise NotFoundError("Issue", issue_id)

    issue_res = await db.execute(select(Issue).where(Issue.id == issue_uuid))
    issue = issue_res.scalar_one_or_none()
    if not issue:
        raise NotFoundError("Issue", issue_id)

    await require_project_member(str(issue.project_id), current_user, db)

    result = await db.execute(
        select(Comment).where(Comment.issue_id == issue_uuid).order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()

    response = []
    for c in comments:
        author_res = await db.execute(select(User).where(User.id == c.author_id))
        author = author_res.scalar_one_or_none()
        response.append(
            CommentResponse(
                id=str(c.id),
                issue_id=str(c.issue_id),
                author_id=str(c.author_id),
                body=c.body,
                created_at=c.created_at,
                updated_at=c.updated_at,
                author=(
                    {"id": str(author.id), "username": author.username, "full_name": author.full_name}
                    if author
                    else None
                ),
            )
        )

    return response


@router.post("/issues/{issue_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    issue_id: str,
    body: CommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> CommentResponse:
    try:
        issue_uuid = uuid.UUID(issue_id)
    except ValueError:
        raise NotFoundError("Issue", issue_id)

    issue_res = await db.execute(select(Issue).where(Issue.id == issue_uuid))
    issue = issue_res.scalar_one_or_none()
    if not issue:
        raise NotFoundError("Issue", issue_id)

    _, pmember = await require_project_member(str(issue.project_id), current_user, db)
    if pmember.role == MemberRole.VIEWER:
        raise ForbiddenError("VIEWER role cannot add comments")

    comment = Comment(
        issue_id=issue.id,
        author_id=current_user.id,
        body=body.body,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)

    return CommentResponse(
        id=str(comment.id),
        issue_id=str(comment.issue_id),
        author_id=str(comment.author_id),
        body=comment.body,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author={
            "id": str(current_user.id),
            "username": current_user.username,
            "full_name": current_user.full_name,
        },
    )


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: str,
    body: CommentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> CommentResponse:
    try:
        comment_uuid = uuid.UUID(comment_id)
    except ValueError:
        raise NotFoundError("Comment", comment_id)

    res = await db.execute(select(Comment).where(Comment.id == comment_uuid))
    comment = res.scalar_one_or_none()
    if not comment:
        raise NotFoundError("Comment", comment_id)

    if comment.author_id != current_user.id:
        raise ForbiddenError("Only the comment author can edit their comment")

    comment.body = body.body
    await db.flush()
    await db.refresh(comment)

    return CommentResponse(
        id=str(comment.id),
        issue_id=str(comment.issue_id),
        author_id=str(comment.author_id),
        body=comment.body,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author={
            "id": str(current_user.id),
            "username": current_user.username,
            "full_name": current_user.full_name,
        },
    )


@router.delete("/comments/{comment_id}", response_model=MessageResponse)
async def delete_comment(
    comment_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    try:
        comment_uuid = uuid.UUID(comment_id)
    except ValueError:
        raise NotFoundError("Comment", comment_id)

    res = await db.execute(select(Comment).where(Comment.id == comment_uuid))
    comment = res.scalar_one_or_none()
    if not comment:
        raise NotFoundError("Comment", comment_id)

    # Allow author or project ADMIN/PM to delete
    if comment.author_id != current_user.id:
        issue_res = await db.execute(select(Issue).where(Issue.id == comment.issue_id))
        issue = issue_res.scalar_one_or_none()
        if issue:
            _, pmember = await require_project_member(str(issue.project_id), current_user, db)
            if pmember.role not in (MemberRole.ADMIN, MemberRole.PROJECT_MANAGER):
                raise ForbiddenError("Only the author or project ADMIN/PM can delete comments")

    await db.delete(comment)
    return MessageResponse(message="Comment deleted successfully")
