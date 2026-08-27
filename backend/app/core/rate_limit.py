from __future__ import annotations

import logging

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Rate limit configs: (max_requests, window_seconds)
RATE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/v1/auth/register": (5, 60),   # 5 requests per minute
    "/api/v1/auth/login": (10, 60),      # 10 requests per minute
    "/api/v1/auth/refresh": (20, 60),    # 20 requests per minute
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if not settings.RATE_LIMIT_ENABLED or path not in RATE_LIMITS:
            return await call_next(request)

        max_requests, window = RATE_LIMITS[path]

        client_ip = request.client.host if request.client else "unknown"
        key = f"rate_limit:{client_ip}:{path}"

        try:
            r = await get_redis()
            current = await r.incr(key)
            if current == 1:
                await r.expire(key, window)

            remaining = max(0, max_requests - current)
            headers = {
                "X-RateLimit-Limit": str(max_requests),
                "X-RateLimit-Remaining": str(remaining),
                "X-RateLimit-Window": str(window),
            }

            if current > max_requests:
                return Response(
                    content='{"error":{"message":"Rate limit exceeded. Please try again later.","status_code":429}}',
                    status_code=429,
                    media_type="application/json",
                    headers=headers,
                )

            response = await call_next(request)
            for k, v in headers.items():
                response.headers[k] = v
            return response

        except Exception:
            logger.warning("Rate limiter Redis connection failed, allowing request")
            return await call_next(request)
