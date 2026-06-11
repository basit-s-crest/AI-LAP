/**
 * Unit tests for useCoachSocket hook.
 *
 * socket.io-client is replaced by the manual mock at
 * src/__mocks__/socket.io-client.ts via the moduleNameMapper in jest config.
 */

import { renderHook, act } from "@testing-library/react";
import { io, mockSocket } from "../__mocks__/socket.io-client";
import type { CoachMessageDTO } from "../types/coachMessage";

// ── Mock next/navigation ─────────────────────────────────────────────────────
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── Import hook AFTER mocks are set up ───────────────────────────────────────
import { useCoachSocket } from "../hooks/useCoachSocket";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Find the handler registered for a given event name. */
function getHandler(eventName: string): ((...args: unknown[]) => void) | undefined {
  const calls = (mockSocket.on as jest.Mock).mock.calls as [string, (...args: unknown[]) => void][];
  const found = calls.find(([name]) => name === eventName);
  return found ? found[1] : undefined;
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Reset localStorage and cookies
  localStorage.clear();
  document.cookie = "safecircle_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useCoachSocket", () => {
  it("calls io() on mount (connects to the backend)", () => {
    renderHook(() => useCoachSocket());
    expect(io).toHaveBeenCalledTimes(1);
  });

  it("passes the JWT token from cookies in auth.token", () => {
    document.cookie = "safecircle_token=test-jwt-token";
    renderHook(() => useCoachSocket());
    const callArgs = (io as jest.Mock).mock.calls[0];
    expect(callArgs[1]).toMatchObject({ auth: { token: "test-jwt-token" } });
  });

  it("calls socket.disconnect() on unmount", () => {
    const { unmount } = renderHook(() => useCoachSocket());
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("registers a new_message listener on mount", () => {
    renderHook(() => useCoachSocket());
    const registeredEvents = (mockSocket.on as jest.Mock).mock.calls.map(
      ([name]: [string]) => name
    );
    expect(registeredEvents).toContain("new_message");
  });

  it("registers a read_receipt listener on mount", () => {
    renderHook(() => useCoachSocket());
    const registeredEvents = (mockSocket.on as jest.Mock).mock.calls.map(
      ([name]: [string]) => name
    );
    expect(registeredEvents).toContain("read_receipt");
  });

  it("invokes onNewMessage callback when new_message event fires", () => {
    const onNewMessage = jest.fn();
    renderHook(() => useCoachSocket({ onNewMessage }));

    const handler = getHandler("new_message");
    expect(handler).toBeDefined();

    const msg: CoachMessageDTO = {
      id: "msg-1",
      userId: "user-1",
      coachId: "coach-1",
      content: "Hello!",
      senderRole: "member",
      read: false,
      createdAt: new Date().toISOString(),
    };

    act(() => {
      handler!(msg);
    });

    expect(onNewMessage).toHaveBeenCalledTimes(1);
    expect(onNewMessage).toHaveBeenCalledWith(msg);
  });

  it("invokes onReadReceipt callback when read_receipt event fires", () => {
    const onReadReceipt = jest.fn();
    renderHook(() => useCoachSocket({ onReadReceipt }));

    const handler = getHandler("read_receipt");
    expect(handler).toBeDefined();

    const receipt = { partnerId: "partner-1", readAt: new Date().toISOString() };

    act(() => {
      handler!(receipt);
    });

    expect(onReadReceipt).toHaveBeenCalledTimes(1);
    expect(onReadReceipt).toHaveBeenCalledWith(receipt);
  });

  it("does not invoke onNewMessage when it is not provided", () => {
    // Should not throw even without a callback
    renderHook(() => useCoachSocket({}));
    const handler = getHandler("new_message");
    expect(() => act(() => handler!({ id: "x" }))).not.toThrow();
  });

  it("does not invoke onReadReceipt when it is not provided", () => {
    renderHook(() => useCoachSocket({}));
    const handler = getHandler("read_receipt");
    expect(() =>
      act(() => handler!({ partnerId: "p", readAt: "2024-01-01T00:00:00Z" }))
    ).not.toThrow();
  });

  it("exposes sendMessage that emits send_message on the socket", () => {
    const { result } = renderHook(() => useCoachSocket());
    act(() => {
      result.current.sendMessage("partner-1", "Hi there");
    });
    expect(mockSocket.emit).toHaveBeenCalledWith("send_message", {
      partnerId: "partner-1",
      content: "Hi there",
    });
  });
});
