/**
 * POST /api/chat
 * Enqueues a coach chat message into BullMQ for LLM inference.
 * The worker picks it up, calls Python FastAPI /v1/ingest/chat,
 * and publishes the result to Redis pub/sub → SSE stream → dashboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { getChatQueue } from "@/lib/vasl/queue";
import { v4 as uuidv4 } from "uuid";
import type { ChatJobPayload } from "@/lib/vasl/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { member_token, session_id, text, client_name, org_id } = body;

    if (!member_token || !text?.trim()) {
      return NextResponse.json(
        { error: "member_token and text are required" },
        { status: 400 }
      );
    }

    const event_id = `evt_${uuidv4().replace(/-/g, "").slice(0, 16)}`;
    const timestamp = new Date().toISOString();

    const jobPayload: ChatJobPayload = {
      event_id,
      org_id: org_id ?? process.env.ORG_ID ?? "org_univ_maryland",
      member_token,
      session_id: session_id ?? `sess_coach_${Date.now()}`,
      role: "member", // analysing the member's message text
      text: text.trim(),
      timestamp,
      consent_active: true,
      client_name: client_name ?? "Unknown",
      enqueue_time: Date.now(),
    };

    const queue = getChatQueue();
    const job = await queue.add("chat-inference", jobPayload, {
      jobId: event_id,
    });

    console.log(`[API /chat] Enqueued job ${job.id} for member=${member_token}`);

    return NextResponse.json(
      { status: "queued", event_id, job_id: job.id },
      { status: 202 }
    );
  } catch (err) {
    console.error("[API /chat] Error:", err);
    return NextResponse.json(
      { error: "Failed to enqueue message" },
      { status: 500 }
    );
  }
}
