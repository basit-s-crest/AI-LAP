/**
 * queue.ts
 * BullMQ Queue — enqueues chat messages for LLM inference.
 * Only the Queue (producer) lives here; the Worker lives in worker.mjs.
 */
import { Queue } from "bullmq";
import { getQueueRedis, CHAT_QUEUE_NAME } from "./redis";
import type { ChatJobPayload } from "./types";

let _queue: Queue<ChatJobPayload> | null = null;

export function getChatQueue(): Queue<ChatJobPayload> {
  if (!_queue) {
    _queue = new Queue<ChatJobPayload>(CHAT_QUEUE_NAME, {
      connection: getQueueRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return _queue;
}
