"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forwardToSentiment = forwardToSentiment;
exports.forwardPeerPostToSentiment = forwardPeerPostToSentiment;
const crypto_1 = require("crypto");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const SCORE_CHANNEL = "vasl_score_updates";
// ── Redis pub client (singleton) ────────────────────────────────────────────
let redisClient = null;
let redisConnectPromise = null;
function createRedisClient() {
    const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379/0";
    const client = new ioredis_1.default(url, {
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
    client.on("error", (err) => {
        const message = err instanceof Error
            ? `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`
            : String(err);
        console.error("[sentiment/redis] error:", message);
    });
    client.on("close", () => {
        console.warn("[sentiment/redis] connection closed");
    });
    client.on("reconnecting", (timeToReconnect) => {
        console.warn("[sentiment/redis] reconnecting in", timeToReconnect, "ms");
    });
    return client;
}
async function getRedis() {
    if (redisClient && redisClient.status === "ready") {
        return redisClient;
    }
    if (!redisClient) {
        redisClient = createRedisClient();
    }
    if (!redisConnectPromise) {
        redisConnectPromise = redisClient
            .connect()
            .then(() => redisClient)
            .catch((err) => {
            redisConnectPromise = null;
            throw err;
        });
    }
    await redisConnectPromise;
    return redisClient;
}
async function safePublish(channel, payload) {
    try {
        const redis = await getRedis();
        await redis.publish(channel, JSON.stringify(payload));
    }
    catch (err) {
        const message = err instanceof Error
            ? `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`
            : String(err);
        console.error("[sentiment/redis] publish failed:", message);
    }
}
function pythonBaseUrl() {
    return (process.env.PYTHON_BACKEND_URL ?? "http://localhost:8001").trim().replace(/\/$/, "");
}
async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
    }
    return (await response.json());
}
function forwardToSentiment(message, messageId) {
    void (async () => {
        const payload = {
            event_id: (0, crypto_1.randomUUID)(),
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
            const resp = await postJson(`${pythonBaseUrl()}/v1/ingest/chat`, payload);
            console.log("[sentiment] enqueued event_id=", resp.event_id, "tier=", resp.risk_tier);
            let clientName = "Member";
            try {
                const user = await prisma_1.default.user.findUnique({
                    where: { id: message.userId },
                    select: { name: true },
                });
                if (user?.name)
                    clientName = user.name;
            }
            catch {
                // non-critical
            }
            const signalCodes = resp.active_signals?.map((s) => s.signal_code).filter(Boolean) ?? [];
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
        }
        catch (err) {
            const reason = err instanceof Error && err.name === "TimeoutError"
                ? "timeout after 15s"
                : err instanceof Error
                    ? err.message
                    : String(err);
            console.error("[sentiment] forward failed:", reason, "| url=", `${pythonBaseUrl()}/v1/ingest/chat`);
        }
    })();
}
function forwardPeerPostToSentiment(post) {
    void (async () => {
        const payload = {
            event_id: (0, crypto_1.randomUUID)(),
            org_id: process.env.PYTHON_ORG_ID ?? "org_default",
            member_token: post.memberId,
            group_id: post.groupId,
            post_id: post.id,
            text: post.body.slice(0, 500),
            timestamp: post.createdAt.toISOString(),
            consent_active: true,
        };
        try {
            const resp = await postJson(`${pythonBaseUrl()}/v1/ingest/peer-post`, payload);
            console.log("[sentiment/peer-post] enqueued event_id=", resp.event_id, "tier=", resp.risk_tier);
            let clientName = post.member?.name ?? "Member";
            if (!post.member) {
                try {
                    const user = await prisma_1.default.user.findUnique({
                        where: { id: post.memberId },
                        select: { name: true },
                    });
                    if (user?.name)
                        clientName = user.name;
                }
                catch {
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
            console.log("[sentiment/peer-post] published to Redis channel=", SCORE_CHANNEL, "tier=", scoreUpdate.risk_tier);
        }
        catch (err) {
            const reason = err instanceof Error && err.name === "TimeoutError"
                ? "timeout after 15s"
                : err instanceof Error
                    ? err.message
                    : String(err);
            console.error("[sentiment/peer-post] forward failed:", reason);
        }
    })();
}
