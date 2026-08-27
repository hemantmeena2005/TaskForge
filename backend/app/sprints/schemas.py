from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.core.enums import SprintStatus


class SprintCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    goal: Optional[str] = Field(None, max_length=2000)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SprintUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    goal: Optional[str] = Field(None, max_length=2000)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class CompleteSprintRequest(BaseModel):
    destination_sprint_id: Optional[str] = Field(
        None, description="Sprint to move unfinished issues to. If null, moves issues to backlog."
    )


class SprintAddIssuesRequest(BaseModel):
    issue_ids: list[str]


class SprintResponse(BaseModel):
    id: str
    project_id: str
    name: str
    goal: Optional[str]
    status: SprintStatus
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    completed_at: Optional[datetime]
    issue_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BurndownPoint(BaseModel):
    day: str
    remaining_issues: int
    completed_issues: int


class SprintStatsResponse(BaseModel):
    sprint_id: str
    total_issues: int
    completed_issues: int
    remaining_issues: int
    completion_percentage: float
    burndown: list[BurndownPoint]
