import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app

# Disable rate limiting and Kafka during tests
settings.RATE_LIMIT_ENABLED = False
settings.KAFKA_ENABLED = False

# Use a separate test database — replace only the database name (last segment)
TEST_DATABASE_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/taskforge_test"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    # Clean up Redis connections after each test
    from app.core import redis as redis_module
    if redis_module.redis_client is not None:
        try:
            await redis_module.redis_client.aclose()
        except Exception:
            pass
        redis_module.redis_client = None


@pytest_asyncio.fixture
async def registered_user(client: AsyncClient) -> dict:
    response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/register",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "securepass123",
            "full_name": "Test User",
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, registered_user: dict) -> dict:
    return {"Authorization": f"Bearer {registered_user['access_token']}"}
