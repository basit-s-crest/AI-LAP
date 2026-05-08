/**
 * redis.ts
 * Singleton Redis connection shared across the Next.js server process.
 * Used by BullMQ Queue (enqueue) and the SSE pub/sub subscriber.
 */
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379/0";

// BullMQ requires a dedicated connection per role (queue vs worker vs subscriber)
function createRedis(lazyConnect = false) {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    lazyConnect,
  });
  client.on("error", (err) => {
    // Suppress ECONNREFUSED noise in dev when Redis isn't running yet
    if ((err as NodeJS.ErrnoException).code !== "ECONNREFUSED") {
      console.error("[Redis]", err.message);
    }
  });
  return client;
}

// Shared queue connection (used by Queue class in API routes)
let _queueRedis: Redis | null = null;
export function getQueueRedis(): Redis {
  if (!_queueRedis) _queueRedis = createRedis();
  return _queueRedis;
}

// Dedicated pub/sub subscriber (used by SSE route)
let _subRedis: Redis | null = null;
export function getSubRedis(): Redis {
  if (!_subRedis) _subRedis = createRedis();
  return _subRedis;
}

// Plain publisher (used by the worker to broadcast score updates)
let _pubRedis: Redis | null = null;
export function getPubRedis(): Redis {
  if (!_pubRedis) _pubRedis = createRedis();
  return _pubRedis;
}

export const SCORE_UPDATE_CHANNEL = "vasl_score_updates";
export const CHAT_QUEUE_NAME = "vasl_chat_inference";
