/**
 * worker.mjs
 * ──────────
 * BullMQ Worker — runs as a standalone Node.js process alongside Next.js.
 *
 * Flow:
 *   1. Dequeues a chat message from the "vasl:chat_inference" BullMQ queue
 *   2. POSTs it to the FastAPI /v1/ingest/chat endpoint (which calls the LLM)
 *   3. Polls FastAPI for the inference result
 *   4. Publishes the score update to Redis pub/sub channel "vasl:score_updates"
 *      → Next.js SSE route picks this up and pushes it to all connected browsers
 *
 * Start with:
 *   npm run worker
 *
 * Or in a separate terminal:
 *   node --env-file=.env.local worker.mjs
 */

import { Worker } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379/0";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const QUEUE_NAME = "vasl_chat_inference";
const CHANNEL = "vasl_score_updates";

// ── Redis pub connection ───────────────────────────────────────────────────────
const pub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
pub.on("error", (e) => console.error("[Worker Redis]", e.message));

// ── Worker ────────────────────────────────────────────────────────────────────
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const payload = job.data;
    console.log(
      `[Worker] Processing job ${job.id} | member=${payload.member_token} | text="${payload.text.slice(0, 60)}..."`
    );

    // ── 1. POST to FastAPI ingest/chat ────────────────────────────────────────
    const ingestRes = await fetch(`${API_URL}/v1/ingest/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: payload.event_id,
        org_id: payload.org_id,
        member_token: payload.member_token,
        session_id: payload.session_id,
        role: payload.role,
        text: payload.text,
        timestamp: payload.timestamp,
        consent_active: payload.consent_active,
      }),
    });

    if (!ingestRes.ok) {
      const err = await ingestRes.text();
      throw new Error(`FastAPI ingest failed (${ingestRes.status}): ${err}`);
    }

    const ingestData = await ingestRes.json();
    console.log(`[Worker] Ingest accepted | event_id=${ingestData.event_id}`);

    // ── 2. Poll for the inference result ─────────────────────────────────────
    // FastAPI processes synchronously (LLM call inside the endpoint),
    // so the result is available immediately via the member results endpoint.
    let inferenceResult = null;
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(1500);
      try {
        const resultRes = await fetch(
          `${API_URL}/v1/results/member/${payload.member_token}`
        );
        if (resultRes.ok) {
          const data = await resultRes.json();
          // Find the event we just submitted
          const event = data.events?.find(
            (e) => e.event_id === payload.event_id
          );
          if (event) {
            inferenceResult = {
              event_id: event.event_id,
              member_token: payload.member_token,
              client_name: payload.client_name,
              risk_tier: event.risk_tier,
              risk_score: event.risk_score,
              risk_trend: event.risk_trend ?? "stable",
              recommended_action: event.recommended_action ?? "no_action",
              active_signals: event.signals ?? [],
              processed_at: new Date().toISOString(),
            };
            break;
          }
          // Fallback: use the snapshot-level data if event not found yet
          if (data.current_risk_tier && i >= 2) {
            inferenceResult = {
              event_id: payload.event_id,
              member_token: payload.member_token,
              client_name: payload.client_name,
              risk_tier: data.current_risk_tier,
              risk_score: data.current_risk_score ?? 0,
              risk_trend: data.risk_trend ?? "stable",
              recommended_action: "schedule_followup",
              active_signals: [],
              processed_at: new Date().toISOString(),
            };
            break;
          }
        }
      } catch (e) {
        console.warn(`[Worker] Poll attempt ${i + 1} failed:`, e.message);
      }
    }

    if (!inferenceResult) {
      // Still publish a minimal update so the dashboard isn't left hanging
      inferenceResult = {
        event_id: payload.event_id,
        member_token: payload.member_token,
        client_name: payload.client_name,
        risk_tier: "low",
        risk_score: 0,
        risk_trend: "stable",
        recommended_action: "no_action",
        active_signals: [],
        processed_at: new Date().toISOString(),
        error: "Result not available yet — check dashboard in a moment",
      };
    }

    // ── 3. Publish score update to Redis pub/sub ──────────────────────────────
    await pub.publish(CHANNEL, JSON.stringify(inferenceResult));
    console.log(
      `[Worker] Published score update | tier=${inferenceResult.risk_tier} | score=${inferenceResult.risk_score}`
    );

    return inferenceResult;
  },
  {
    connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null }),
    concurrency: 3,
  }
);

worker.on("completed", (job, result) => {
  console.log(
    `[Worker] ✓ Job ${job.id} completed | tier=${result?.risk_tier ?? "?"}`
  );
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] ✗ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err.message);
});

console.log(`[Worker] Started — listening on queue "${QUEUE_NAME}"`);
console.log(`[Worker] FastAPI URL: ${API_URL}`);
console.log(`[Worker] Redis: ${REDIS_URL}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
