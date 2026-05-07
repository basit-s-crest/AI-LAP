/**
 * test_pipeline.mjs
 * ─────────────────
 * End-to-end pipeline load test — 100 requests through the full stack.
 *
 * ── How central logging works ─────────────────────────────────────────────────
 *
 * Every process writes its timing into a shared Redis Hash:
 *   Key:    vasl:timing:{event_id}
 *   Fields: written by each process as it completes its stage
 *
 *   Process          Stage  Fields written
 *   ───────────────  ─────  ──────────────────────────────────────────────────
 *   test_pipeline    [1]    s1_enqueue_ms, enqueue_time, text, job_num
 *   worker.mjs       [2]    s2_fastapi_ms, s2_fastapi_done_at
 *   worker.mjs       [1]    s1_queue_wait_ms, worker_pickup_at
 *   FastAPI          [3]    s3_llm_ms, fastapi_received_at, fastapi_total_ms
 *   FastAPI          [4]    s4_db_ms  (background task, arrives later)
 *   worker.mjs       [5]    s5_publish_ms, s5_published_at
 *   test_pipeline    [6]    s6_e2e_ms, result_received_at
 *
 * When the test file receives the SSE result for a job, it:
 *   1. Waits 2s for the DB background task to finish writing [4]
 *   2. Reads the complete Redis hash
 *   3. Writes one JSON record to pipeline_timings.jsonl
 *   4. Prints a formatted one-liner to the console
 *
 * ── Output files ──────────────────────────────────────────────────────────────
 *   pipeline_timings.jsonl   — one JSON object per line, one per request
 *   pipeline_summary.json    — aggregate stats after all jobs complete
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *   node --env-file=.env.local test_pipeline.mjs
 *   node --env-file=.env.local test_pipeline.mjs --count=10
 *   node --env-file=.env.local test_pipeline.mjs --count=100 --timeout=600000
 *
 * ── Prerequisites ─────────────────────────────────────────────────────────────
 *   1. docker start redis
 *   2. uvicorn main:app --reload          (project root)
 *   3. cd azadi-next && npm run worker
 */

import { Queue }    from "bullmq";
import Redis        from "ioredis";
import { randomBytes } from "crypto";
import { createWriteStream } from "fs";
import { writeFile } from "fs/promises";

// ── Config ────────────────────────────────────────────────────────────────────
const REDIS_URL  = process.env.REDIS_URL           ?? "redis://localhost:6379/0";
const QUEUE_NAME = "vasl_chat_inference";
const CHANNEL    = "vasl_score_updates";
const TIMING_TTL = 600;

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? "true"]; })
);

const TOTAL_JOBS   = parseInt(args.count   ?? "100",    10);
const MEMBER_TOKEN = args.token ?? "mbr_bf18c4d442624cd09a06";
const ORG_ID       = args.org   ?? "org_univ_maryland";
const TIMEOUT_MS   = parseInt(args.timeout ?? "300000", 10);
const LOG_FILE     = args.out   ?? "pipeline_timings.jsonl";
const LOG_FILE_TXT = LOG_FILE.replace(/\.jsonl$/, "") + ".log";
const DB_WAIT_MS   = 2000;  // wait for FastAPI background task to write [4]

// ── 100 short test messages (3-5 words, all risk tiers) ───────────────────────
const MESSAGES = [
  "feeling okay today thanks",       "had a good day",
  "things are looking up",           "grateful for small wins",
  "slept well last night",           "went for a walk",
  "talked to a friend",              "feeling calm and grounded",
  "managed stress pretty well",      "enjoyed my morning coffee",
  "finished my homework today",      "feeling hopeful about tomorrow",
  "had a productive session",        "breathing exercises really helped",
  "connected with family today",     "feeling supported and heard",
  "made progress on goals",          "feeling lighter this week",
  "grateful for this community",     "small steps feel big",
  "feeling a bit overwhelmed",       "stressed about upcoming exams",
  "hard to focus lately",            "not sleeping well enough",
  "feeling disconnected from friends","anxious about my future",
  "struggling with motivation today","feeling kind of lost",
  "work stress is building",         "hard to get up",
  "feeling behind on everything",    "not sure what helps",
  "crying more than usual",          "feeling numb and empty",
  "withdrawing from people lately",  "appetite has been off",
  "feeling like a burden",           "nothing feels enjoyable anymore",
  "hard to concentrate today",       "feeling really drained lately",
  "can't stop worrying constantly",  "feel completely worthless today",
  "nobody understands what I feel",  "everything feels pointless now",
  "I've been isolating myself",      "stopped answering texts lately",
  "skipped class all week",          "can't keep going like this",
  "feel like giving up",             "nothing will ever improve",
  "I'm so tired fighting",           "feel like a failure",
  "can't do this anymore",           "feel completely alone here",
  "lost all hope recently",          "don't see the point",
  "feel invisible to everyone",      "exhausted from pretending okay",
  "feel like disappearing sometimes","nobody would even notice",
  "thinking about ending it",        "don't want to exist",
  "made a plan already",             "I have a plan",
  "can't stop these thoughts",       "thinking about hurting myself",
  "been cutting again lately",       "pills are in cabinet",
  "just want it over",               "goodbye to everyone here",
  "tell them I love",                "finally made my decision",
  "feel at peace now",               "just need tonight over",
  "after this won't matter",         "unaliving seems like relief",
  "no reason to stay",               "everyone better without me",
  "I can't hold on",                 "made up my mind",
  "ngl lowkey been struggling",      "fr fr can't cope",
  "tbh nobody checks on me",         "it's not that deep",
  "I know I'm dramatic",             "other people have worse",
  "my family doesn't understand",    "in our culture we don't",
  "my state passed another bill",    "family rejected me completely",
  "I'm fine smiley face",            "everything is fine now",
  "I'm over it totally",             "suddenly feeling at peace",
  "no cap I'm done",                 "lowkey thinking dark thoughts",
  "fr don't want to",                "ngl been really dark",
  "tbh I'm not okay",                "I can't do this",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const ts    = () => new Date().toISOString();
const uid   = () => randomBytes(8).toString("hex");
const rpad  = (s, w) => String(s).padEnd(w);
const lpad  = (s, w) => String(s).padStart(w);
const int   = (v)    => v != null && v !== "" ? parseInt(v, 10) : null;

function pct(n, total) {
  return total === 0 ? "0.0" : ((n / total) * 100).toFixed(1);
}
function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)];
}
function bar(n, total, w = 24) {
  const f = total === 0 ? 0 : Math.round((n / total) * w);
  return "█".repeat(f) + "░".repeat(w - f);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── State ─────────────────────────────────────────────────────────────────────
const jobRecords = new Map();   // event_id → { jobNum, text, enqueue_time, s1_enqueue_ms }
const stats = {
  enqueued: 0, received: 0, errors: 0,
  tiers: { low: 0, moderate: 0, high: 0, crisis: 0 },
  s1: [], s2: [], s3: [], s4: [], s5: [], s6: [],
  wallStart: null,
};

// ── Log file streams ──────────────────────────────────────────────────────────
const logStream    = createWriteStream(LOG_FILE,     { flags: "w" });
const logStreamTxt = createWriteStream(LOG_FILE_TXT, { flags: "w" });

function writeRecord(record) {
  logStream.write(JSON.stringify(record) + "\n");
}

/** Write a line to both the terminal and the human-readable .log file */
function logLine(line) {
  console.log(line);
  logStreamTxt.write(line + "\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const D = "═".repeat(70);
  logLine(`\n${D}`);
  logLine(`  AZADI PIPELINE TEST  —  ${TOTAL_JOBS} jobs  concurrency=20`);
  logLine(`  Output: ${LOG_FILE}`);
  logLine(D);
  logLine(`
  All 6 timing stages collected into one record per request:
    [1] frontend → BullMQ      Redis enqueue latency
    [2] BullMQ → FastAPI       Queue wait + HTTP round-trip
    [3] LLM call               OpenRouter latency (measured by FastAPI)
    [4] LLM → Postgres         Background DB save (measured by FastAPI)
    [5] LLM → BullMQ publish   Redis publish latency
    [6] frontend ← BullMQ      Full end-to-end round-trip
  `);

  // ── Redis connections ─────────────────────────────────────────────────────
  const qRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const sRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const tRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: null }); // timing reads
  for (const r of [qRedis, sRedis, tRedis]) {
    r.on("error", e => { if (e.code !== "ECONNREFUSED") console.error("[Redis]", e.message); });
  }

  // ── BullMQ queue ──────────────────────────────────────────────────────────
  const queue = new Queue(QUEUE_NAME, {
    connection: qRedis,
    defaultJobOptions: {
      attempts: 3, backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 500, removeOnFail: 200,
    },
  });

  // ── Subscribe to results ──────────────────────────────────────────────────
  await sRedis.subscribe(CHANNEL);

  sRedis.on("message", async (_ch, raw) => {
    try {
      const result = JSON.parse(raw);
      const rec    = jobRecords.get(result.event_id);
      if (!rec) return;

      const t_received = Date.now();
      const s6_e2e_ms  = t_received - rec.enqueue_time;

      stats.received++;
      stats.tiers[result.risk_tier] = (stats.tiers[result.risk_tier] ?? 0) + 1;
      stats.s6.push(s6_e2e_ms);

      // Write [6] into the timing hash
      await tRedis.hset(`vasl:timing:${result.event_id}`, {
        s6_e2e_ms:          String(s6_e2e_ms),
        result_received_at: String(t_received),
        risk_tier:          result.risk_tier,
        risk_score:         String(result.risk_score ?? 0),
      });

      // Wait briefly for FastAPI's background [4] DB save to write its timing
      await sleep(DB_WAIT_MS);

      // ── Read the complete timing hash ─────────────────────────────────────
      const h = await tRedis.hgetall(`vasl:timing:${result.event_id}`);

      const s1 = int(h?.s1_enqueue_ms);
      const s1w = int(h?.s1_queue_wait_ms);
      const s2 = int(h?.s2_fastapi_ms);
      const s3 = int(h?.s3_llm_ms);
      const s4 = int(h?.s4_db_ms);
      const s5 = int(h?.s5_publish_ms);

      if (s1 != null) stats.s1.push(s1);
      if (s2 != null) stats.s2.push(s2);
      if (s3 != null) stats.s3.push(s3);
      if (s4 != null) stats.s4.push(s4);
      if (s5 != null) stats.s5.push(s5);

      // ── Build the central log record ──────────────────────────────────────
      const record = {
        job_num:          rec.jobNum,
        event_id:         result.event_id,
        text:             rec.text,
        risk_tier:        result.risk_tier,
        risk_score:       result.risk_score,
        timings: {
          s1_frontend_to_bullmq_ms:  s1,
          s1_queue_wait_ms:          s1w,
          s2_bullmq_to_fastapi_ms:   s2,
          s3_llm_call_ms:            s3,
          s4_llm_to_postgres_ms:     s4,
          s5_llm_to_publish_ms:      s5,
          s6_full_roundtrip_ms:      s6_e2e_ms,
        },
        timestamps: {
          enqueue_time:         rec.enqueue_time,
          worker_pickup_at:     int(h?.worker_pickup_at),
          fastapi_received_at:  int(h?.fastapi_received_at),
          s3_llm_done_at:       int(h?.s3_llm_done_at),
          s4_db_done_at:        int(h?.s4_db_done_at),
          s5_published_at:      int(h?.s5_published_at),
          result_received_at:   t_received,
        },
      };

      // Write to JSONL file
      writeRecord(record);

      // ── Console one-liner ─────────────────────────────────────────────────
      logLine(
        `[${ts()}]` +
        ` #${lpad(rec.jobNum, 3)}` +
        `  tier=${rpad(result.risk_tier, 8)}` +
        `  [1]=${lpad(s1 ?? "?", 4)}ms` +
        `  [2]=${lpad(s2 ?? "?", 5)}ms` +
        `  [3]=${lpad(s3 ?? "?", 5)}ms` +
        `  [4]=${lpad(s4 ?? "?", 5)}ms` +
        `  [5]=${lpad(s5 ?? "?", 4)}ms` +
        `  [6]=${lpad(s6_e2e_ms, 6)}ms` +
        `  | "${rec.text}"`
      );

      if (stats.received + stats.errors >= TOTAL_JOBS) {
        await printSummary();
        cleanup(queue, qRedis, sRedis, tRedis);
      }
    } catch (e) {
      console.error("[result error]", e.message);
    }
  });

  // ── Enqueue all jobs at once ──────────────────────────────────────────────
  stats.wallStart = Date.now();
  logLine(`[${ts()}] Enqueueing ${TOTAL_JOBS} jobs...\n`);
  logLine(
    `  #   [1]enq  | text`
  );
  logLine("  " + "─".repeat(66));

  const enqueuePromises = [];

  for (let i = 0; i < TOTAL_JOBS; i++) {
    const jobNum       = i + 1;
    const text         = MESSAGES[i % MESSAGES.length];
    const event_id     = `evt_test_${uid()}`;
    const enqueue_time = Date.now();

    const payload = {
      event_id,
      org_id:         ORG_ID,
      member_token:   MEMBER_TOKEN,
      session_id:     `sess_test_${uid()}`,
      role:           "member",
      text,
      timestamp:      new Date().toISOString(),
      consent_active: true,
      client_name:    "Test Member",
      enqueue_time,   // worker uses this to compute queue wait time
    };

    enqueuePromises.push(
      queue.add("chat-inference", payload, { jobId: event_id })
        .then(async () => {
          const s1_enqueue_ms = Date.now() - enqueue_time;
          stats.enqueued++;
          jobRecords.set(event_id, { jobNum, text, enqueue_time, s1_enqueue_ms });

          // Write [1] into the timing hash
          await tRedis.hset(`vasl:timing:${event_id}`, {
            s1_enqueue_ms:  String(s1_enqueue_ms),
            enqueue_time:   String(enqueue_time),
            text:           text,
            job_num:        String(jobNum),
          });
          await tRedis.expire(`vasl:timing:${event_id}`, TIMING_TTL);

          logLine(
            `  ${lpad(jobNum, 3)}  ${lpad(s1_enqueue_ms, 4)}ms  | "${text}"`
          );
        })
        .catch(err => {
          stats.errors++;
          console.error(`  ${lpad(jobNum, 3)}  FAILED  ${err.message}`);
        })
    );
  }

  await Promise.all(enqueuePromises);
  const enqueueWall = Date.now() - stats.wallStart;

  logLine("\n" + "  " + "─".repeat(66));
  logLine(`  ${stats.enqueued} jobs enqueued in ${enqueueWall}ms`);
  logLine(`\n[${ts()}] Waiting for results...\n`);
  logLine(
    `  #   [1]enq  [2]api   [3]llm   [4]db    [5]pub  [6]e2e   | text`
  );
  logLine("  " + "─".repeat(66));

  // ── Timeout ───────────────────────────────────────────────────────────────
  setTimeout(async () => {
    if (stats.received + stats.errors < TOTAL_JOBS) {
      console.warn(`\n[TIMEOUT] ${stats.received}/${TOTAL_JOBS} received`);
      await printSummary();
      cleanup(queue, qRedis, sRedis, tRedis);
    }
  }, TIMEOUT_MS);
}

// ── Summary ───────────────────────────────────────────────────────────────────
async function printSummary() {
  const wallMs = Date.now() - stats.wallStart;
  const D = "═".repeat(70);

  const stageStats = (arr, label) => {
    if (!arr.length) return `  ${label.padEnd(30)} no data`;
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    return (
      `  ${label.padEnd(30)}` +
      `  min=${lpad(Math.min(...arr), 5)}ms` +
      `  avg=${lpad(avg, 5)}ms` +
      `  p90=${lpad(percentile(arr, 90), 5)}ms` +
      `  max=${lpad(Math.max(...arr), 5)}ms`
    );
  };

  const summary = {
    run_at:           new Date().toISOString(),
    total_jobs:       TOTAL_JOBS,
    enqueued:         stats.enqueued,
    received:         stats.received,
    errors:           stats.errors,
    wall_time_ms:     wallMs,
    throughput_rps:   parseFloat(((stats.received / wallMs) * 1000).toFixed(3)),
    tier_distribution: stats.tiers,
    stage_stats: {
      s1_frontend_to_bullmq: summariseArr(stats.s1),
      s2_bullmq_to_fastapi:  summariseArr(stats.s2),
      s3_llm_call:           summariseArr(stats.s3),
      s4_llm_to_postgres:    summariseArr(stats.s4),
      s5_llm_to_publish:     summariseArr(stats.s5),
      s6_full_roundtrip:     summariseArr(stats.s6),
    },
  };

  await writeFile("pipeline_summary.json", JSON.stringify(summary, null, 2));

  logLine(`\n${D}`);
  logLine(`  PIPELINE TEST COMPLETE`);
  logLine(D);
  logLine(`  Jobs:       ${stats.enqueued} enqueued  ${stats.received} received  ${stats.errors} errors`);
  logLine(`  Wall time:  ${(wallMs / 1000).toFixed(1)}s`);
  logLine(`  Throughput: ${summary.throughput_rps} jobs/sec`);
  logLine(`\n  Per-stage latency (ms):`);
  logLine(stageStats(stats.s1, "[1] frontend → BullMQ"));
  logLine(stageStats(stats.s2, "[2] BullMQ → FastAPI"));
  logLine(stageStats(stats.s3, "[3] LLM call"));
  logLine(stageStats(stats.s4, "[4] LLM → Postgres"));
  logLine(stageStats(stats.s5, "[5] LLM → BullMQ pub"));
  logLine(stageStats(stats.s6, "[6] full round-trip"));
  logLine(`\n  Risk tier distribution:`);
  const total = stats.received;
  for (const [tier, count] of Object.entries(stats.tiers)) {
    logLine(
      `    ${rpad(tier, 10)}  ${lpad(count, 4)}  (${lpad(pct(count, total), 5)}%)  ${bar(count, total)}`
    );
  }
  logLine(`\n  Log file:     ${LOG_FILE}`);
  logLine(`  Log (text):   ${LOG_FILE_TXT}`);
  logLine(`  Summary file: pipeline_summary.json`);
  logLine(D + "\n");
}

function summariseArr(arr) {
  if (!arr.length) return null;
  return {
    count: arr.length,
    min:   Math.min(...arr),
    avg:   Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    p50:   percentile(arr, 50),
    p90:   percentile(arr, 90),
    p99:   percentile(arr, 99),
    max:   Math.max(...arr),
  };
}

async function cleanup(queue, ...redisClients) {
  logStream.end();
  logStreamTxt.end();
  try { await queue.close(); } catch {}
  for (const r of redisClients) { try { r.disconnect(); } catch {} }
  process.exit(0);
}

main().catch(err => {
  console.error("[FATAL]", err);
  process.exit(1);
});
