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
// ── Redis pub client (lazy, singleton) ────────────────────────────────────────
let _redis = null;
function getRedis() {
    if (!_redis) {
        const url = process.env.REDIS_URL ?? "redis://localhost:6379/0";
        _redis = new ioredis_1.default(url, { maxRetriesPerRequest: null });
        _redis.on("error", (e) => {
            if (e.code !== "ECONNREFUSED") {
                console.error("[sentiment/redis]", e.message);
            }
        });
    }
    return _redis;
}
const SCORE_CHANNEL = "vasl_score_updates";
function forwardToSentiment(message) {
    const payload = {
        event_id: (0, crypto_1.randomUUID)(),
        org_id: process.env.PYTHON_ORG_ID ?? "org_default",
        member_token: message.userId,
        session_id: `${message.userId}_${message.coachId}`,
        role: "member",
        text: message.content.slice(0, 500),
        timestamp: message.createdAt.toISOString(),
        consent_active: true,
    };
    // Intentionally not awaited — fire-and-forget
    // Timeout is 15s: the Python endpoint runs an LLM call (3-5s) before
    // returning 202, so 5s was too tight and caused frequent AbortErrors.
    fetch(`${process.env.PYTHON_BACKEND_URL}/v1/ingest/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
    })
        .then((r) => r.json())
        .then(async (resp) => {
        console.log("[sentiment] enqueued event_id=", resp.event_id, "tier=", resp.risk_tier);
        // Look up the member's name for the dashboard display
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
            // non-critical — fall back to "Member"
        }
        // Publish to Redis so the SSE stream → dashboard picks it up
        // (same shape the worker publishes)
        const scoreUpdate = {
            event_id: resp.event_id ?? payload.event_id,
            member_token: message.userId,
            client_name: clientName,
            risk_tier: resp.risk_tier ?? "low",
            risk_score: resp.risk_score ?? 0,
            risk_trend: resp.risk_trend ?? "stable",
            recommended_action: resp.recommended_action ?? "no_action",
            active_signals: resp.active_signals ?? [],
            processed_at: new Date().toISOString(),
        };
        try {
            await getRedis().publish(SCORE_CHANNEL, JSON.stringify(scoreUpdate));
            console.log("[sentiment] published to Redis channel=", SCORE_CHANNEL, "tier=", scoreUpdate.risk_tier);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("[sentiment] Redis publish failed:", msg);
        }
    })
        .catch((e) => {
        const reason = e.name === "TimeoutError" ? "timeout after 15s" : e.message;
        console.error("[sentiment] forward failed:", reason);
    });
}
/**
 * Fire-and-forget: sends a newly created peer group post to the Python
 * backend at POST /v1/ingest/peer-post, then publishes the sentiment
 * result to Redis so the coach dashboard SSE stream picks it up.
 */
function forwardPeerPostToSentiment(post) {
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
    fetch(`${process.env.PYTHON_BACKEND_URL}/v1/ingest/peer-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
    })
        .then((r) => r.json())
        .then(async (resp) => {
        console.log("[sentiment/peer-post] enqueued event_id=", resp.event_id, "tier=", resp.risk_tier);
        // Resolve member name for dashboard display
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
        try {
            await getRedis().publish(SCORE_CHANNEL, JSON.stringify(scoreUpdate));
            console.log("[sentiment/peer-post] published to Redis channel=", SCORE_CHANNEL, "tier=", scoreUpdate.risk_tier);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("[sentiment/peer-post] Redis publish failed:", msg);
        }
    })
        .catch((e) => {
        const reason = e.name === "TimeoutError" ? "timeout after 15s" : e.message;
        console.error("[sentiment/peer-post] forward failed:", reason);
    });
}
