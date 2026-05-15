import { forwardToSentiment } from "../services/sentimentForwarder";
import { CoachMessage } from "@prisma/client";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeCoachMessage(overrides: Partial<CoachMessage> = {}): CoachMessage {
  return {
    id: "msg-1",
    userId: "user-abc",
    coachId: "coach-xyz",
    content: "Hello, how are you?",
    senderRole: "member",
    read: false,
    createdAt: new Date("2024-01-15T10:30:00.000Z"),
    updatedAt: new Date("2024-01-15T10:30:00.000Z"),
    ...overrides,
  };
}

describe("forwardToSentiment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PYTHON_BACKEND_URL = "http://localhost:8000";
    process.env.PYTHON_ORG_ID = "org_test";
  });

  // 12.1 — Never throws
  it("should return void synchronously without throwing", () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage();
    expect(() => forwardToSentiment(message, message.id)).not.toThrow();
  });

  it("should not throw even when fetch rejects", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const message = makeCoachMessage();
    expect(() => forwardToSentiment(message, message.id)).not.toThrow();
    // Wait for the async chain to settle
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it("should not throw even when fetch times out (AbortError)", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValue(abortError);
    const message = makeCoachMessage();
    expect(() => forwardToSentiment(message, message.id)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it("should not throw even when response.json() rejects", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.reject(new Error("Invalid JSON")),
    });
    const message = makeCoachMessage();
    expect(() => forwardToSentiment(message, message.id)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  // 12.2 — Caller responsibility: forwardToSentiment is only called for member messages
  // The function itself doesn't check senderRole — the caller (coachChat.ts) does.
  // We test that the function DOES call fetch (it's the caller's job to gate it).
  it("should call fetch when invoked (caller is responsible for gating coach messages)", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage({ senderRole: "member" });
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // 12.3 — Payload shape
  it("should POST to PYTHON_BACKEND_URL/v1/ingest/chat", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage();
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/v1/ingest/chat",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("should include all required ChatIngestPayload fields", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage();
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body).toHaveProperty("event_id");
    expect(body).toHaveProperty("org_id");
    expect(body).toHaveProperty("member_token");
    expect(body).toHaveProperty("session_id");
    expect(body).toHaveProperty("role");
    expect(body).toHaveProperty("text");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("consent_active");
    expect(body).toHaveProperty("original_source_id", "msg-1");
  });

  it("should set role to 'member'", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage();
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.role).toBe("member");
  });

  it("should set consent_active to true", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage();
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.consent_active).toBe(true);
  });

  it("should set member_token to message.userId", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage({ userId: "user-abc" });
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.member_token).toBe("user-abc");
  });

  it("should set session_id to '{userId}_{coachId}'", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage({ userId: "user-abc", coachId: "coach-xyz" });
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.session_id).toBe("user-abc_coach-xyz");
  });

  it("should set timestamp to message.createdAt.toISOString()", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const createdAt = new Date("2024-01-15T10:30:00.000Z");
    const message = makeCoachMessage({ createdAt });
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.timestamp).toBe("2024-01-15T10:30:00.000Z");
  });

  it("should set org_id from PYTHON_ORG_ID env var", async () => {
    process.env.PYTHON_ORG_ID = "org_custom";
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage();
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.org_id).toBe("org_custom");
  });

  it("should truncate text to 500 chars when content is longer", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const longContent = "x".repeat(1000);
    const message = makeCoachMessage({ content: longContent });
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toHaveLength(500);
    expect(body.text).toBe("x".repeat(500));
  });

  it("should not truncate text when content is exactly 500 chars", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const exactContent = "y".repeat(500);
    const message = makeCoachMessage({ content: exactContent });
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toHaveLength(500);
  });

  it("should not truncate text when content is shorter than 500 chars", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const shortContent = "Hello!";
    const message = makeCoachMessage({ content: shortContent });
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toBe("Hello!");
  });

  it("should use 'org_default' when PYTHON_ORG_ID is not set", async () => {
    delete process.env.PYTHON_ORG_ID;
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage();
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.org_id).toBe("org_default");
  });

  it("should generate a unique event_id (UUID v4 format) for each call", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    const message = makeCoachMessage();
    forwardToSentiment(message, message.id);
    forwardToSentiment(message, message.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);
    const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body1.event_id).not.toBe(body2.event_id);
    // UUID v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(body1.event_id).toMatch(uuidRegex);
  });
});
