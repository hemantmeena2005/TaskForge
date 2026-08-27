from __future__ import annotations

import json
import logging
from typing import Any, Optional

import redis.asyncio as redis

logger = logging.getLogger(__name__)

DEFAULT_TTL = 300  # 5 minutes


async def cache_get(r: redis.Redis, key: str) -> Any | None:
    try:
        val = await r.get(key)
        if val:
            return json.loads(val)
    except Exception:
        logger.warning(f"Cache GET failed for key={key}")
    return None


async def cache_set(r: redis.Redis, key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
    try:
        await r.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        logger.warning(f"Cache SET failed for key={key}")


async def cache_delete(r: redis.Redis, key: str) -> None:
    try:
        await r.delete(key)
    except Exception:
        logger.warning(f"Cache DELETE failed for key={key}")


async def cache_delete_pattern(r: redis.Redis, pattern: str) -> None:
    try:
        keys = []
        async for key in r.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await r.delete(*keys)
    except Exception:
        logger.warning(f"Cache DELETE pattern failed for pattern={pattern}")
