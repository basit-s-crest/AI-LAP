/**
 * redis.ts
 * Singleton Redis connections for BullMQ queue and SSE pub/sub.
 * Used by API routes — server-side only.
 */
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379/0";

function createRedis() {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
  });
  client.on("error", (err) => {
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

export function getRedisOptions() {
  try {
    const u = new URL(REDIS_URL);
    return {
      host: u.hostname,
      port: parseInt(u.port || "6379", 10),
      username: u.username || undefined,
      password: u.password || undefined,
      db: parseInt(u.pathname?.replace("/", "") || "0", 10),
      maxRetriesPerRequest: null,
    };
  } catch {
    return {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
}

export const SCORE_UPDATE_CHANNEL = "vasl_score_updates";
export const CHAT_QUEUE_NAME = "vasl_chat_inference";
