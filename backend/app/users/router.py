from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.users.models import User
from app.users.schemas import UserSearchResult

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserSearchResult])
async def search_users(
    search: Optional[str] = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserSearchResult]:
    query = select(User).where(User.is_active.is_(True))

    if search and search.strip():
        term = search.strip().lstrip("@")
        pattern = f"%{term}%"
        query = query.where(
            or_(
                User.username.ilike(pattern),
                User.email.ilike(pattern),
                User.full_name.ilike(pattern),
            )
        )

    query = query.order_by(User.username.asc()).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return [
        UserSearchResult(
            id=str(u.id),
            email=u.email,
            username=u.username,
            full_name=u.full_name,
        )
        for u in users
    ]
