from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.core.enums import IssuePriority, IssueStatus


class StatusCount(BaseModel):
    status: IssueStatus
    count: int


class PriorityCount(BaseModel):
    priority: IssuePriority
    count: int


class ActiveSprintInfo(BaseModel):
    id: str
    project_id: str
    project_name: str
    name: str
    goal: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]


class SprintProgress(BaseModel):
    total_issues: int
    completed_issues: int
    remaining_issues: int
    completion_percentage: float


class DashboardActivityItem(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: Optional[str]
    user_id: Optional[str]
    created_at: datetime


class MyProject(BaseModel):
    id: str
    name: str
    key: str
    description: Optional[str]
    is_archived: bool


class DashboardResponse(BaseModel):
    total_projects: int
    open_issues: int
    completed_issues: int
    active_sprint: Optional[ActiveSprintInfo]
    sprint_progress: Optional[SprintProgress]
    issues_by_status: list[StatusCount]
    issues_by_priority: list[PriorityCount]
    recent_activity: list[DashboardActivityItem]
