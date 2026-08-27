from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.auth.schemas import UserPublic
from app.core.enums import MemberRole


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    key: str = Field(..., min_length=2, max_length=10, pattern=r"^[A-Z0-9]+$")
    description: Optional[str] = Field(None, max_length=2000)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)


class ProjectMemberAdd(BaseModel):
    user_id: str
    role: MemberRole = MemberRole.DEVELOPER


class ProjectMemberResponse(BaseModel):
    id: str
    user_id: str
    role: MemberRole
    created_at: datetime
    user: Optional[UserPublic] = None

    model_config = {"from_attributes": True}


class ProjectResponse(BaseModel):
    id: str
    name: str
    key: str
    description: Optional[str]
    organization_id: str
    owner_id: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
