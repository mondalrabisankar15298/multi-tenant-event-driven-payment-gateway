"""
Rate Limiter — Redis Sorted Set Sliding Window Counter.

Industry-standard approach (Stripe, Cloudflare pattern).
Each request is scored by timestamp. Expired entries are pruned on every check.
"""
import time
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

import redis.asyncio as aioredis

from ..config import settings
from ..services.oauth_service import get_cached_consumer

logger = logging.getLogger(__name__)


@dataclass
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    reset_at: int       # Unix timestamp when window resets
    window_seconds: int
    retry_after: int | None = None  # Seconds until reset (only on 429)


class RateLimiter:
    def __init__(self):
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def check_rate_limit(self, consumer_id: str) -> RateLimitResult:
        """Check and record a request against the consumer's rate limit."""
        redis = await self._get_redis()

        # Get consumer's limits (Redis-cached)
        consumer = await get_cached_consumer(consumer_id)
        max_requests = settings.RATE_LIMIT_DEFAULT_REQUESTS
        window_seconds = settings.RATE_LIMIT_DEFAULT_WINDOW_SECONDS

        if consumer:
            max_requests = consumer.get("rate_limit_requests", max_requests)
            window_seconds = consumer.get("rate_limit_window_seconds", window_seconds)

        key = f"rate_limit:{consumer_id}"
        now = time.time()
        window_start = now - window_seconds

        # Atomic pipeline — prune expired, count, add, set TTL
        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(uuid4()): now})
        pipe.expire(key, window_seconds)
        results = await pipe.execute()

        current_count = results[1]
        reset_at = int(now + window_seconds)

        if current_count >= max_requests:
            # Calculate retry_after from oldest entry in the sorted set
            oldest = await redis.zrange(key, 0, 0, withscores=True)
            if oldest:
                oldest_timestamp = oldest[0][1]
                retry_after = int(oldest_timestamp + window_seconds - now)
            else:
                retry_after = window_seconds
            return RateLimitResult(
                allowed=False,
                limit=max_requests,
                remaining=0,
                reset_at=reset_at,
                window_seconds=window_seconds,
                retry_after=max(retry_after, 1),
            )

        return RateLimitResult(
            allowed=True,
            limit=max_requests,
            remaining=max(0, max_requests - current_count - 1),
            reset_at=reset_at,
            window_seconds=window_seconds,
        )

    async def get_rate_limit_status(self, consumer_id: str) -> dict:
        """Read-only: inspect current sliding window state for Admin UI. Does NOT increment the counter."""
        redis = await self._get_redis()

        consumer = await get_cached_consumer(consumer_id)
        max_requests = settings.RATE_LIMIT_DEFAULT_REQUESTS
        window_seconds = settings.RATE_LIMIT_DEFAULT_WINDOW_SECONDS

        if consumer:
            max_requests = consumer.get("rate_limit_requests", max_requests)
            window_seconds = consumer.get("rate_limit_window_seconds", window_seconds)

        key = f"rate_limit:{consumer_id}"
        now = time.time()
        window_start_ts = now - window_seconds

        # Prune expired entries first (non-mutating of valid entries)
        await redis.zremrangebyscore(key, 0, window_start_ts)
        calls_made = await redis.zcard(key)

        # Oldest entry = window start
        oldest = await redis.zrange(key, 0, 0, withscores=True)
        if oldest:
            window_start_actual = oldest[0][1]
            window_end_actual = window_start_actual + window_seconds
        else:
            window_start_actual = now
            window_end_actual = now + window_seconds

        return {
            "limit": max_requests,
            "window_seconds": window_seconds,
            "calls_made": calls_made,
            "calls_remaining": max(0, max_requests - calls_made),
            "window_start": datetime.fromtimestamp(window_start_actual, tz=timezone.utc).isoformat(),
            "window_end": datetime.fromtimestamp(window_end_actual, tz=timezone.utc).isoformat(),
            "reset_at": int(window_end_actual),
        }

    async def check_oauth_rate_limit(self, client_id: str) -> RateLimitResult:
        """Separate rate limit for OAuth token endpoint (brute-force protection)."""
        redis = await self._get_redis()

        key = f"oauth_rate:{client_id}"
        now = time.time()
        window_seconds = 60  # 1 minute window
        max_requests = settings.OAUTH_RATE_LIMIT_PER_MINUTE
        window_start = now - window_seconds

        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(uuid4()): now})
        pipe.expire(key, window_seconds)
        results = await pipe.execute()

        current_count = results[1]
        reset_at = int(now + window_seconds)

        if current_count >= max_requests:
            return RateLimitResult(
                allowed=False,
                limit=max_requests,
                remaining=0,
                reset_at=reset_at,
                window_seconds=window_seconds,
                retry_after=max(1, window_seconds),
            )

        return RateLimitResult(
            allowed=True,
            limit=max_requests,
            remaining=max(0, max_requests - current_count - 1),
            reset_at=reset_at,
            window_seconds=window_seconds,
        )


# Singleton
rate_limiter = RateLimiter()
