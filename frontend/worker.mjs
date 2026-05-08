/**
 * worker.mjs
 * ──────────
 * BullMQ Worker — processes chat inference jobs.
 *
 * Dequeues jobs from BullMQ → calls Python FastAPI /v1/ingest/chat
 * → publishes result to Redis pub/sub → SSE stream → dashboard.
 *
 * Run alongside Next.js dev server:
 *   node worker.mjs
 *
 * Concurrency = 20 → up to 20 parallel LLM calls at once.
 */

import { Worker } from "bullmq";
import Redis from "ioredis";

const REDIS_URL  = process.env.REDIS_URL           ?? "redis://localhost:6379/0";
const API_URL    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const QUEUE_NAME = "vasl_chat_inference";
const CHANNEL    = "vasl_score_updates";
const TIMING_TTL = 600; // seconds

// ── Redis connections ─────────────────────────────────────────────────────────
const pub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const tim = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
pub.on("error", e => { if (e.code !== "ECONNREFUSED") console.error("[pub]", e.message); });
tim.on("error", e => { if (e.code !== "ECONNREFUSED") console.error("[tim]", e.message); });

// ── Helpers ───────────────────────────────────────────────────────────────────
const ts  = () => new Date().toISOString();
const now = () => Date.now();

async function writeTiming(eventId, fields) {
  try {
    const key = `vasl:timing:${eventId}`;
    const flat = {};
    for (const [k, v] of Object.entries(fields)) flat[k] = String(v);
    await tim.hset(key, flat);
    await tim.expire(key, TIMING_TTL);
  } catch { /* non-critical */ }
}

function log(jobId, stage, detail, elapsedMs) {
  const e = elapsedMs != null ? `  +${elapsedMs}ms` : "";
  console.log(`[${ts()}] [${String(jobId).slice(-8)}] ${stage.padEnd(26)}${e}  ${detail}`);
}

// ── Worker ────────────────────────────────────────────────────────────────────
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const p  = job.data;
    const t0 = now();

    // [1] queue wait
    const s1_queue_wait_ms = p.enqueue_time ? t0 - p.enqueue_time : null;
    log(job.id, "[1] queue wait", `text="${p.text.slice(0, 45)}"`, s1_queue_wait_ms);
    await writeTiming(p.event_id, {
      s1_queue_wait_ms: s1_queue_wait_ms ?? "",
      worker_pickup_at: t0,
    });

    // [2] BullMQ → Python FastAPI
    const t1 = now();
    log(job.id, "[2] BullMQ→FastAPI", `event_id=${p.event_id}`);

    let resp;
    try {
      const res = await fetch(`${API_URL}/v1/ingest/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id:       p.event_id,
          org_id:         p.org_id,
          member_token:   p.member_token,
          session_id:     p.session_id,
          role:           p.role ?? "member",
          text:           p.text,
          timestamp:      p.timestamp,
          consent_active: p.consent_active ?? true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      resp = await res.json();
    } catch (err) {
      log(job.id, "[2] FastAPI FAILED", err.message, now() - t1);
      await writeTiming(p.event_id, { s2_error: err.message.slice(0, 200) });
      throw err;
    }

    const t2 = now();
    const s2_fastapi_ms = t2 - t1;
    log(job.id, "[2] FastAPI responded",
      `tier=${resp.risk_tier ?? "?"}  score=${resp.risk_score ?? "?"}`,
      s2_fastapi_ms);

    const s3_llm_ms = resp.timing_llm_ms ?? null;
    if (s3_llm_ms != null) {
      log(job.id, "[3] LLM (inside FastAPI)", `OpenRouter round-trip`, s3_llm_ms);
    }

    await writeTiming(p.event_id, { s2_fastapi_ms, s2_fastapi_done_at: t2 });

    // [5] Publish result to Redis → SSE → dashboard
    const t3 = now();
    const scoreUpdate = {
      event_id:           resp.event_id,
      member_token:       p.member_token,
      client_name:        p.client_name ?? "Member",
      risk_tier:          resp.risk_tier          ?? "low",
      risk_score:         resp.risk_score         ?? 0,
      risk_trend:         resp.risk_trend         ?? "stable",
      recommended_action: resp.recommended_action ?? "no_action",
      active_signals:     resp.active_signals     ?? [],
      processed_at:       new Date().toISOString(),
    };

    await pub.publish(CHANNEL, JSON.stringify(scoreUpdate));
    const t4 = now();
    const s5_publish_ms = t4 - t3;
    log(job.id, "[5] published to Redis",
      `tier=${scoreUpdate.risk_tier}  channel=${CHANNEL}`,
      s5_publish_ms);

    await writeTiming(p.event_id, { s5_publish_ms, s5_published_at: t4 });

    const workerTotal = t4 - t0;
    log(job.id, "✓ worker done",
      `total=${workerTotal}ms  fastapi=${s2_fastapi_ms}ms  llm=${s3_llm_ms ?? "?"}ms`);

    return { event_id: p.event_id, risk_tier: scoreUpdate.risk_tier };
  },
  {
    connection:  new Redis(REDIS_URL, { maxRetriesPerRequest: null }),
    concurrency: 20,
  }
);

worker.on("completed", (job, r) => {
  console.log(`[${ts()}] [${String(job.id).slice(-8)}] ✓ COMPLETE  tier=${r?.risk_tier}`);
});

worker.on("failed", (job, err) => {
  console.error(`[${ts()}] [${String(job?.id).slice(-8)}] ✗ FAILED  ${err.message}`);
});

worker.on("error", err => {
  if (err.code !== "ECONNREFUSED") console.error(`[${ts()}] [Worker]`, err.message);
});

console.log(`\n${"─".repeat(60)}`);
console.log(`  VASL Worker started  concurrency=20`);
console.log(`  Queue:   ${QUEUE_NAME}`);
console.log(`  FastAPI: ${API_URL}`);
console.log(`  Redis:   ${REDIS_URL}`);
console.log(`${"─".repeat(60)}\n`);
