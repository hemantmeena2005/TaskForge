from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler, unhandled_error_handler
from app.core.logging_config import setup_logging
from app.core.redis import close_redis, get_redis
from app.core.rate_limit import RateLimitMiddleware
from app.core.kafka_producer import close_producer

# Import Base + all models so Alembic can detect them
from app.core.database import Base  # noqa: F401
from app.users.models import User  # noqa: F401
from app.auth.models import RefreshToken  # noqa: F401
from app.organizations.models import Organization, OrganizationMember  # noqa: F401
from app.projects.models import Project, ProjectMember  # noqa: F401
from app.issues.models import Issue, Label  # noqa: F401
from app.sprints.models import Sprint  # noqa: F401
from app.comments.models import Comment  # noqa: F401
from app.notifications.models import Notification  # noqa: F401
from app.audit.models import AuditLog  # noqa: F401

from app.auth.router import router as auth_router
from app.organizations.router import router as org_router
from app.projects.router import router as project_router
from app.issues.router import router as issue_router
from app.sprints.router import router as sprint_router
from app.comments.router import router as comment_router
from app.notifications.router import router as notification_router
from app.audit.router import router as audit_router
from app.dashboard.router import router as dashboard_router
from app.users.router import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    # Warm up Redis connection
    await get_redis()
    yield
    await close_producer()
    await close_redis()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting
    app.add_middleware(RateLimitMiddleware)

    # Exception handlers
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_error_handler)

    # Routers
    app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
    app.include_router(org_router, prefix=settings.API_V1_PREFIX)
    app.include_router(project_router, prefix=settings.API_V1_PREFIX)
    app.include_router(issue_router, prefix=settings.API_V1_PREFIX)
    app.include_router(sprint_router, prefix=settings.API_V1_PREFIX)
    app.include_router(comment_router, prefix=settings.API_V1_PREFIX)
    app.include_router(notification_router, prefix=settings.API_V1_PREFIX)
    app.include_router(audit_router, prefix=settings.API_V1_PREFIX)
    app.include_router(dashboard_router, prefix=settings.API_V1_PREFIX)
    app.include_router(users_router, prefix=settings.API_V1_PREFIX)

    # Health check
    @app.get("/health")
    async def health_check() -> dict[str, str]:
        return {"status": "healthy", "service": settings.APP_NAME}

    @app.get("/api/v1/health")
    async def api_health_check() -> dict[str, str]:
        return {"status": "healthy", "service": settings.APP_NAME, "version": settings.APP_VERSION}

    return app


app = create_app()
