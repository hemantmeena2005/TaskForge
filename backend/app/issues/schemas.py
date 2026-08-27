from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.auth.schemas import UserPublic
from app.core.enums import IssuePriority, IssueStatus, IssueType


class LabelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field("#6B7280", pattern=r"^#[0-9a-fA-F]{6}$")


class LabelResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    color: str
    created_at: datetime

    model_config = {"from_attributes": True}


class IssueCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    type: IssueType = IssueType.TASK
    priority: IssuePriority = IssuePriority.MEDIUM
    status: IssueStatus = IssueStatus.TODO
    assignee_id: Optional[str] = None
    sprint_id: Optional[str] = None
    due_date: Optional[datetime] = None
    label_ids: list[str] = Field(default_factory=list)


class IssueUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    type: Optional[IssueType] = None
    priority: Optional[IssuePriority] = None
    status: Optional[IssueStatus] = None
    assignee_id: Optional[str] = None
    sprint_id: Optional[str] = None
    due_date: Optional[datetime] = None
    label_ids: Optional[list[str]] = None


class IssueMoveRequest(BaseModel):
    status: IssueStatus
    version: int = Field(..., description="Expected version for optimistic concurrency control")


class IssueAssign(BaseModel):
    assignee_id: Optional[str] = None


class IssueStatusUpdate(BaseModel):
    status: IssueStatus


class IssuePriorityUpdate(BaseModel):
    priority: IssuePriority


class IssueResponse(BaseModel):
    id: str
    issue_number: int
    issue_key: str
    title: str
    description: Optional[str]
    type: IssueType
    priority: IssuePriority
    status: IssueStatus
    project_id: str
    reporter_id: str
    assignee_id: Optional[str]
    sprint_id: Optional[str]
    due_date: Optional[datetime]
    version: int
    created_at: datetime
    updated_at: datetime
    reporter: Optional[UserPublic] = None
    assignee: Optional[UserPublic] = None
    labels: list[LabelResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class PaginationMeta(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int


class IssueListResponse(BaseModel):
    items: list[IssueResponse]
    meta: PaginationMeta


class BoardColumnResponse(BaseModel):
    status: IssueStatus
    issues: list[IssueResponse]
    total_count: int


class BoardResponse(BaseModel):
    project_id: str
    columns: list[BoardColumnResponse]
