/**
 * Unit tests for useCoachMessages hook.
 *
 * Tests verify:
 * 1. POST /read is called on mount
 * 2. POST /read is called when window focus event fires
 * 3. prependMessage updates the TanStack Query cache without triggering a network refetch
 */

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CoachMessageDTO, ThreadPage } from "../types/coachMessage";

// ── Mock next/navigation ─────────────────────────────────────────────────────
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// ── Mock @/lib/api ────────────────────────────────────────────────────────────
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();

jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

// ── Import hook AFTER mocks ───────────────────────────────────────────────────
import { useCoachMessages } from "../hooks/useCoachMessages";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<CoachMessageDTO> = {}): CoachMessageDTO {
  return {
    id: "msg-1",
    userId: "user-1",
    coachId: "coach-1",
    content: "Hello",
    senderRole: "member",
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeThreadPage(messages: CoachMessageDTO[], nextCursor: string | null = null): ThreadPage {
  return { messages, nextCursor };
}

/** Create a fresh QueryClient for each test to avoid cache bleed-over. */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Disable background refetching so we can assert no extra calls
        staleTime: Infinity,
        refetchOnWindowFocus: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper: Wrapper, queryClient };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: GET returns an empty page, POST resolves successfully
  mockApiGet.mockResolvedValue({ data: makeThreadPage([]) });
  mockApiPost.mockResolvedValue({ data: {} });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useCoachMessages", () => {
  describe("POST /read on mount", () => {
    it("calls POST /api/coach-messages/:partnerId/read on mount", async () => {
      const { wrapper } = createWrapper();
      renderHook(() => useCoachMessages("partner-1"), { wrapper });

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          "/api/coach-messages/partner-1/read"
        );
      });
    });

    it("uses the correct partnerId in the read URL", async () => {
      const { wrapper } = createWrapper();
      renderHook(() => useCoachMessages("coach-abc"), { wrapper });

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          "/api/coach-messages/coach-abc/read"
        );
      });
    });
  });

  describe("POST /read on window focus", () => {
    it("calls POST /read when window focus event fires", async () => {
      const { wrapper } = createWrapper();
      renderHook(() => useCoachMessages("partner-1"), { wrapper });

      // Wait for mount call
      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledTimes(1);
      });

      // Simulate window focus
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledTimes(2);
      });

      // Both calls should be to the same endpoint
      expect(mockApiPost).toHaveBeenNthCalledWith(
        2,
        "/api/coach-messages/partner-1/read"
      );
    });

    it("removes the focus listener on unmount", async () => {
      const { wrapper } = createWrapper();
      const { unmount } = renderHook(() => useCoachMessages("partner-1"), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledTimes(1);
      });

      unmount();
      jest.clearAllMocks();

      // Focus after unmount should NOT trigger another POST
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });

      // Give any async work a chance to run
      await new Promise((r) => setTimeout(r, 50));
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe("prependMessage — cache update without refetch", () => {
    it("adds the new message to the cache", async () => {
      const existingMsg = makeMessage({ id: "existing-1", content: "Old message" });
      mockApiGet.mockResolvedValue({ data: makeThreadPage([existingMsg]) });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCoachMessages("partner-1"), {
        wrapper,
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.messages).toHaveLength(1);

      const newMsg = makeMessage({ id: "new-1", content: "New socket message" });
      const getCallsBefore = mockApiGet.mock.calls.length;

      act(() => {
        result.current.prependMessage(newMsg);
      });

      // Message should appear in the cache
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });
      expect(result.current.messages.some((m) => m.id === "new-1")).toBe(true);

      // No additional GET calls should have been made
      expect(mockApiGet.mock.calls.length).toBe(getCallsBefore);
    });

    it("creates an initial cache entry when no data is loaded yet", async () => {
      // Simulate a slow/pending query by never resolving
      mockApiGet.mockReturnValue(new Promise(() => {}));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCoachMessages("partner-1"), {
        wrapper,
      });

      const newMsg = makeMessage({ id: "socket-msg-1" });

      act(() => {
        result.current.prependMessage(newMsg);
      });

      // The message should be in the messages array even before the query resolves
      await waitFor(() => {
        expect(result.current.messages.some((m) => m.id === "socket-msg-1")).toBe(
          true
        );
      });
    });

    it("does not trigger a network refetch when prependMessage is called", async () => {
      const existingMsg = makeMessage({ id: "e-1" });
      mockApiGet.mockResolvedValue({ data: makeThreadPage([existingMsg]) });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCoachMessages("partner-1"), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callCountAfterLoad = mockApiGet.mock.calls.length;

      act(() => {
        result.current.prependMessage(makeMessage({ id: "new-2" }));
      });

      // Allow any potential async work
      await new Promise((r) => setTimeout(r, 50));

      expect(mockApiGet.mock.calls.length).toBe(callCountAfterLoad);
    });

    it("preserves existing messages when prepending a new one", async () => {
      const msgs = [
        makeMessage({ id: "m1", content: "First" }),
        makeMessage({ id: "m2", content: "Second" }),
      ];
      mockApiGet.mockResolvedValue({ data: makeThreadPage(msgs) });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCoachMessages("partner-1"), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      act(() => {
        result.current.prependMessage(makeMessage({ id: "m3", content: "Third" }));
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(3);
      });
      expect(result.current.messages.map((m) => m.id)).toContain("m1");
      expect(result.current.messages.map((m) => m.id)).toContain("m2");
      expect(result.current.messages.map((m) => m.id)).toContain("m3");
    });
  });

  describe("messages array", () => {
    it("returns an empty array when no messages are loaded", async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCoachMessages("partner-1"), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
    });

    it("flattens messages from the loaded page", async () => {
      const msgs = [makeMessage({ id: "a" }), makeMessage({ id: "b" })];
      mockApiGet.mockResolvedValue({ data: makeThreadPage(msgs) });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useCoachMessages("partner-1"), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });
    });
  });
});
