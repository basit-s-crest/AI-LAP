import { randomUUID } from "crypto";
import type { CoachMessage, PeerGroupPost } from "@prisma/client";
import Redis from "ioredis";
import prisma from "../lib/prisma";
import { emailOrgCrisisAlert } from "./notificationEmail.service";

interface ChatIngestPayload {
  event_id: string;
  org_id: string;
  member_token: string;
  session_id: string;
  role: "member";
  text: string;
  timestamp: string;
  consent_active: boolean;
  original_source_id: string;
}

interface IngestResponse {
  event_id?: string;
  risk_tier?: string;
  risk_score?: number;
  risk_trend?: string;
  recommended_action?: string;
  active_signals?: Array<{
    signal_code: string;
    signal_label: string | null;
    confidence: number;
    dimension: string | null;
  }>;
}

interface PeerPostIngestPayload {
  event_id: string;
  org_id: string;
  member_token: string;
  group_id: string;
  post_id: string;
  text: string;
  timestamp: string;
  consent_active: boolean;
}

const SCORE_CHANNEL = "vasl_score_updates";

// ── Redis pub client (singleton) ────────────────────────────────────────────
let redisClient: Redis | null = null;
let redisConnectPromise: Promise<Redis> | null = null;

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379/0";
  console.log("[sentiment/redis] Initializing client pointing to: " + url.replace(/:[^:@\n]+@/g, ':***@'));

  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    enableReadyCheck: true,
    retryStrategy(times) {
      return Math.min(times * 100, 2000);
    },
    reconnectOnError(err) {
      console.error("[sentiment/redis] reconnectOnError:", err?.message ?? err);
      return false;
    },
  });

  client.on("connect", () => {
    console.log("[sentiment/redis] connecting...");
  });

  client.on("ready", () => {
    console.log("[sentiment/redis] ready");
  });

  client.on("error", (err: unknown) => {
    const message =
      err instanceof Error
        ? `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`
        : String(err);

    console.error("[sentiment/redis] error:", message);
  });

  client.on("close", () => {
    console.warn("[sentiment/redis] connection closed");
  });

  client.on("reconnecting", (timeToReconnect: number) => {
    console.warn("[sentiment/redis] reconnecting in", timeToReconnect, "ms");
  });

  return client;
}

async function getRedis(): Promise<Redis> {
  if (redisClient && redisClient.status === "ready") {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createRedisClient();
  }

  if (!redisConnectPromise) {
    redisConnectPromise = redisClient
      .connect()
      .then(() => redisClient as Redis)
      .catch((err) => {
        redisConnectPromise = null;
        throw err;
      });
  }

  await redisConnectPromise;
  return redisClient;
}

async function safePublish(channel: string, payload: unknown): Promise<void> {
  try {
    const redis = await getRedis();
    await redis.publish(channel, JSON.stringify(payload));
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`
        : String(err);

    console.error("[sentiment/redis] publish failed:", message);
  }
}

function pythonBaseUrl(): string {
  return (process.env.PYTHON_BACKEND_URL ?? "http://localhost:8001").trim().replace(/\/$/, "");
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
  }

  return (await response.json()) as T;
}

export function forwardToSentiment(message: CoachMessage, messageId: string): void {
  void (async () => {
    const payload: ChatIngestPayload = {
      event_id: randomUUID(),
      org_id: process.env.PYTHON_ORG_ID ?? "org_default",
      member_token: message.userId,
      session_id: `${message.userId}_${message.coachId}`,
      role: "member",
      text: message.content.slice(0, 500),
      timestamp: message.createdAt.toISOString(),
      consent_active: true,
      original_source_id: messageId,
    };

    try {
      const resp = await postJson<IngestResponse>(
        `${pythonBaseUrl()}/v1/ingest/chat`,
        payload
      );

      console.log("[sentiment] enqueued event_id=", resp.event_id, "tier=", resp.risk_tier);

      let clientName = "Member";
      try {
        const user = await prisma.user.findUnique({
          where: { id: message.userId },
          select: { name: true },
        });
        if (user?.name) clientName = user.name;
      } catch {
        // non-critical
      }

      const signalCodes =
        resp.active_signals?.map((s) => s.signal_code).filter(Boolean) ?? [];

      const scoreUpdate = {
        event_id: resp.event_id ?? payload.event_id,
        original_source_id: messageId,
        member_token: message.userId,
        client_name: clientName,
        risk_tier: resp.risk_tier ?? "low",
        risk_score: resp.risk_score ?? 0,
        risk_trend: resp.risk_trend ?? "stable",
        recommended_action: resp.recommended_action ?? "no_action",
        active_signals: resp.active_signals ?? [],
        signal_codes: signalCodes,
        processed_at: new Date().toISOString(),
      };

      await safePublish(SCORE_CHANNEL, scoreUpdate);
      console.log("[sentiment] published to Redis channel=", SCORE_CHANNEL, "tier=", scoreUpdate.risk_tier);

      const tier = (resp.risk_tier ?? "low").toLowerCase();
      if (tier === "crisis" || tier === "high") {
        const member = await prisma.user.findUnique({
          where: { id: message.userId },
          select: { organizationId: true, name: true },
        });
        if (member?.organizationId) {
          void emailOrgCrisisAlert(
            member.organizationId,
            clientName,
            tier,
            resp.recommended_action
              ? `Recommended action: ${resp.recommended_action}`
              : undefined
          );
        }
      }
    } catch (err: unknown) {
      const reason =
        err instanceof Error && err.name === "TimeoutError"
          ? "timeout after 15s"
          : err instanceof Error
            ? err.message
            : String(err);

      console.error(
        "[sentiment] forward failed:",
        reason,
        "| url=",
        `${pythonBaseUrl()}/v1/ingest/chat`
      );
    }
  })();
}

export function forwardPeerPostToSentiment(
  post: PeerGroupPost & { member?: { name: string | null } | null }
): void {
  void (async () => {
    const payload: PeerPostIngestPayload = {
      event_id: randomUUID(),
      org_id: process.env.PYTHON_ORG_ID ?? "org_default",
      member_token: post.memberId,
      group_id: post.groupId,
      post_id: post.id,
      text: post.body.slice(0, 500),
      timestamp: post.createdAt.toISOString(),
      consent_active: true,
    };

    try {
      const resp = await postJson<IngestResponse>(
        `${pythonBaseUrl()}/v1/ingest/peer-post`,
        payload
      );

      console.log(
        "[sentiment/peer-post] enqueued event_id=",
        resp.event_id,
        "tier=",
        resp.risk_tier
      );

      let clientName = post.member?.name ?? "Member";
      if (!post.member) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: post.memberId },
            select: { name: true },
          });
          if (user?.name) clientName = user.name;
        } catch {
          // non-critical
        }
      }

      const scoreUpdate = {
        event_id: resp.event_id ?? payload.event_id,
        member_token: post.memberId,
        client_name: clientName,
        source: "peer_post",
        group_id: post.groupId,
        post_id: post.id,
        risk_tier: resp.risk_tier ?? "low",
        risk_score: resp.risk_score ?? 0,
        risk_trend: resp.risk_trend ?? "stable",
        recommended_action: resp.recommended_action ?? "no_action",
        active_signals: resp.active_signals ?? [],
        processed_at: new Date().toISOString(),
      };

      await safePublish(SCORE_CHANNEL, scoreUpdate);
      console.log(
        "[sentiment/peer-post] published to Redis channel=",
        SCORE_CHANNEL,
        "tier=",
        scoreUpdate.risk_tier
      );
    } catch (err: unknown) {
      const reason =
        err instanceof Error && err.name === "TimeoutError"
          ? "timeout after 15s"
          : err instanceof Error
            ? err.message
            : String(err);

      console.error("[sentiment/peer-post] forward failed:", reason);
    }
  })();
}

interface ChangeInsightIngestPayload {
  event_id: string;
  org_id: string;
  member_token: string;
  text: string;
  timestamp: string;
  consent_active: boolean;
  original_source_id: string;
}

export function forwardChangeInsightToSentiment(
  insight: any,
  orgId: string
): void {
  void (async () => {
    const payload: ChangeInsightIngestPayload = {
      event_id: randomUUID(),
      org_id: orgId,
      member_token: insight.memberId,
      text: (insight.summary || "").slice(0, 10000),
      timestamp: (insight.createdAt || new Date()).toISOString(),
      consent_active: true,
      original_source_id: insight.id,
    };

    try {
      const resp = await postJson<IngestResponse>(
        `${pythonBaseUrl()}/v1/ingest/change-insight`,
        payload
      );

      console.log(
        "[sentiment/change-insight] enqueued event_id=",
        resp.event_id,
        "tier=",
        resp.risk_tier
      );

      let clientName = "Member";
      try {
        const user = await prisma.user.findUnique({
          where: { id: insight.memberId },
          select: { name: true },
        });
        if (user?.name) clientName = user.name;
      } catch {
        // non-critical
      }

      const scoreUpdate = {
        event_id: resp.event_id ?? payload.event_id,
        member_token: insight.memberId,
        client_name: clientName,
        source: "change_insight",
        risk_tier: resp.risk_tier ?? "low",
        risk_score: resp.risk_score ?? 0,
        risk_trend: resp.risk_trend ?? "stable",
        recommended_action: resp.recommended_action ?? "no_action",
        active_signals: resp.active_signals ?? [],
        processed_at: new Date().toISOString(),
      };

      await safePublish(SCORE_CHANNEL, scoreUpdate);
      console.log(
        "[sentiment/change-insight] published to Redis channel=",
        SCORE_CHANNEL,
        "tier=",
        scoreUpdate.risk_tier
      );
    } catch (err: unknown) {
      const reason =
        err instanceof Error && err.name === "TimeoutError"
          ? "timeout after 15s"
          : err instanceof Error
            ? err.message
            : String(err);

      console.error("[sentiment/change-insight] forward failed:", reason);
    }
  })();
}