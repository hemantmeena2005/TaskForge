from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.auth.schemas import UserPublic


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


class CommentUpdate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


class CommentResponse(BaseModel):
    id: str
    issue_id: str
    author_id: str
    body: str
    created_at: datetime
    updated_at: datetime
    author: Optional[UserPublic] = None

    model_config = {"from_attributes": True}
