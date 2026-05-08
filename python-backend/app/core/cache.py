"""
cache.py
--------
Redis caching layer for dashboard endpoints.

Uses redis-py (async) with a simple JSON cache.
If Redis is unavailable, all operations degrade gracefully —
the app continues to work, just without caching.

Environment variables:
    REDIS_URL   — Redis connection URL (default: redis://localhost:6379/0)
    CACHE_TTL   — Cache TTL in seconds (default: 60)
"""

import os
import json
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

# ── Lazy Redis client ─────────────────────────────────────────────────────────

_redis = None


def _get_redis():
    """Return async Redis client, or None if redis is not installed / unavailable."""
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis.asyncio as aioredis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis = aioredis.from_url(url, decode_responses=True)
        logger.info("Redis cache connected: %s", url)
    except ImportError:
        logger.warning("redis package not installed — caching disabled")
        _redis = None
    except Exception as exc:
        logger.warning("Redis connection failed (%s) — caching disabled", exc)
        _redis = None
    return _redis


CACHE_TTL: int = int(os.getenv("CACHE_TTL", "60"))

# ── Key builders ──────────────────────────────────────────────────────────────

def _member_key(member_token: str) -> str:
    return f"vasl:member:{member_token}"


def _admin_key(org_id: str) -> str:
    return f"vasl:admin:{org_id}"


# ── Public helpers ────────────────────────────────────────────────────────────

async def get_cached(key: str) -> Optional[Any]:
    """Return parsed JSON from cache, or None on miss / error."""
    r = _get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Cache GET failed for key=%s: %s", key, exc)
        return None


async def set_cached(key: str, value: Any, ttl: int = CACHE_TTL) -> None:
    """Serialize value to JSON and store in cache with TTL."""
    r = _get_redis()
    if r is None:
        return
    try:
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        logger.warning("Cache SET failed for key=%s: %s", key, exc)


async def bust_member_cache(member_token: str) -> None:
    """Delete cached member result (called after new event is stored)."""
    r = _get_redis()
    if r is None:
        return
    try:
        await r.delete(_member_key(member_token))
        logger.debug("Cache busted for member: %s", member_token)
    except Exception as exc:
        logger.warning("Cache bust failed for member=%s: %s", member_token, exc)


async def bust_admin_cache(org_id: str) -> None:
    """Delete cached admin summary (called after new event is stored)."""
    r = _get_redis()
    if r is None:
        return
    try:
        await r.delete(_admin_key(org_id))
        logger.debug("Cache busted for org: %s", org_id)
    except Exception as exc:
        logger.warning("Cache bust failed for org=%s: %s", org_id, exc)


# ── Convenience wrappers used by dashboard router ─────────────────────────────

async def get_member_cache(member_token: str) -> Optional[Any]:
    return await get_cached(_member_key(member_token))


async def set_member_cache(member_token: str, data: Any) -> None:
    await set_cached(_member_key(member_token), data)


async def get_admin_cache(org_id: str) -> Optional[Any]:
    return await get_cached(_admin_key(org_id))


async def set_admin_cache(org_id: str, data: Any) -> None:
    await set_cached(_admin_key(org_id), data)
