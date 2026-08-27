from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, EmailStr


class UserSearchResult(BaseModel):
    id: str
    email: EmailStr
    username: str
    full_name: Optional[str] = None

    model_config = {"from_attributes": True}
