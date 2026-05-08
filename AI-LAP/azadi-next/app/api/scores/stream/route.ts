/**
 * GET /api/scores/stream
 * Server-Sent Events endpoint.
 * Subscribes to the Redis "vasl:score_updates" pub/sub channel
 * and streams score update events to connected browser clients.
 *
 * Each event is a JSON-encoded ScoreUpdateEvent.
 */
import { NextRequest } from "next/server";
import { getSubRedis, SCORE_UPDATE_CHANNEL } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  // Each SSE connection gets its own Redis subscriber instance
  // (Redis subscriptions are connection-scoped)
  const sub = getSubRedis().duplicate();

  const stream = new ReadableStream({
    start(controller) {
      // Send a heartbeat comment every 20s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 20_000);

      // Send initial connection confirmation
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      sub.subscribe(SCORE_UPDATE_CHANNEL, (err) => {
        if (err) {
          console.error("[SSE] Redis subscribe error:", err.message);
          controller.error(err);
        }
      });

      sub.on("message", (_channel, message) => {
        try {
          const payload = JSON.parse(message);
          const sseData = `data: ${JSON.stringify({ type: "score_update", payload })}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch (e) {
          console.error("[SSE] Failed to parse message:", e);
        }
      });

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        sub.unsubscribe(SCORE_UPDATE_CHANNEL).catch(() => {});
        sub.quit().catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
