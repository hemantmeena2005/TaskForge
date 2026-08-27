from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.auth.schemas import UserPublic
from app.core.enums import MemberRole


class OrgCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=255, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = Field(None, max_length=1000)


class OrgUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)


class OrgMemberAdd(BaseModel):
    user_id: str
    role: MemberRole = MemberRole.DEVELOPER


class OrgMemberUpdateRole(BaseModel):
    role: MemberRole


class OrgMemberResponse(BaseModel):
    id: str
    user_id: str
    role: MemberRole
    created_at: datetime
    user: Optional[UserPublic] = None

    model_config = {"from_attributes": True}


class OrgJoinRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=32)


class OrgInviteCodeResponse(BaseModel):
    invite_code: str


class OrgResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    owner_id: str
    invite_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrgDetailResponse(OrgResponse):
    member_count: int = 0
