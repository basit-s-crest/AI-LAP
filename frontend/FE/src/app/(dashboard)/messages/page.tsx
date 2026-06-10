"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/redux";
import { resolveMemberCoachMessageLink } from "@/lib/memberCoachChat";
import { setActiveCoachMessagesPartner } from "@/lib/activeView";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/cn";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LiveKitApiService } from "@/services/livekit.service";
import type { LiveKitTokenResponse } from "@/types/livekit";
import SessionVideoCall from "@/components/livekit/SessionVideoCall";
import { useCoachMessages } from "@/hooks/useCoachMessages";
import { useCoachSocket } from "@/hooks/useCoachSocket";
import type { ConversationSummary, CoachMessageDTO } from "@/types/coachMessage";
import {
  loadRiskCache,
  mergeRiskCache,
  riskFromMessageDto,
  type MessageRiskMeta,
} from "@/lib/msgRiskCache";
import { subscribeRiskDashboard } from "@/lib/riskEventStore";
import { useRiskScoreStream } from "@/hooks/useRiskScoreStream";
import MeetingModal from "@/components/session/MeetingModal";

interface CoachSessionRow {
  id: string;
  coachId: string;
  memberId: string;
  memberName: string;
  date: string;
  duration: number;
  type: string;
  status: string;
  livekitStartedAt?: string | null;
  livekitEndedAt?: string | null;
  createdAt: string;
}

function formatSessionDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(status: string) {
  switch (status) {
    case "upcoming":
      return "blue";
    case "cancelled":
      return "red";
    case "rescheduled":
      return "gold";
    default:
      return "sage";
  }
}


const TIER_EMOJI: Record<string, string> = {
  crisis: "🔴",
  high: "🟠",
  moderate: "🟡",
  low: "🟢",
};

const TIER_BADGE_PILL: Record<string, { bg: string; text: string }> = {
  low: { bg: "#e8f5e9", text: "#2e7d32" },
  moderate: { bg: "#fff8e1", text: "#f57f17" },
  high: { bg: "#fff3e0", text: "#e65100" },
  crisis: { bg: "#ffebee", text: "#c62828" },
};

// ── Tier colours ───────────────────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  low:      "#4E8C58",
  moderate: "#B8832A",
  high:     "#B35A38",
  crisis:   "#C0392B",
};
const TIER_BG: Record<string, string> = {
  low:      "#D4EDD7",
  moderate: "#F5E6C8",
  high:     "#F5DDD4",
  crisis:   "#FAE0DC",
};


// ── Date separator helpers ─────────────────────────────────────────────────
function getDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_CONVERSATIONS: ConversationSummary[] = [];

// ── Component ──────────────────────────────────────────────────────────────
export default function CoachMessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerFromUrl = searchParams.get("partner");
  const role = useAppSelector((s) => s.auth.user?.role);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (role !== "user") return;
    void resolveMemberCoachMessageLink().then((href) => router.replace(href));
  }, [role, router]);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [inputText, setInputText]       = useState("");
  const [sending, setSending]           = useState(false);
  const [showBanner, setShowBanner]     = useState(false);

  const [meetingSessionId, setMeetingSessionId] = useState<string | null>(null);
  const [meetingMemberId, setMeetingMemberId] = useState<string | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingClientName, setMeetingClientName] = useState("");
  const [meetingSessionTime, setMeetingSessionTime] = useState("");

  const { dashboard, latestUpdate } = useRiskScoreStream(selectedId);
  const scoreUpdates = dashboard.scores;
  // Track unread counts locally so read_receipt can update them in real time
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [riskByMessageId, setRiskByMessageId] = useState<Record<string, MessageRiskMeta>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"messages" | "sessions">("messages");
  const [sessionRowLoading, setSessionRowLoading] = useState<Record<string, boolean>>({});

  // ── Fetch coach sessions ───────────────────────────────────────────────
  const { data: coachSessions = [], isLoading: sessionsLoading } = useQuery<CoachSessionRow[]>({
    queryKey: ["coach-sessions"],
    queryFn: async () => {
      const { data } = await api.get<CoachSessionRow[]>("/api/sessions/coach");
      return data;
    },
  });

  // ── Fetch conversation list ────────────────────────────────────────────
  const { data: conversations = EMPTY_CONVERSATIONS, isLoading: convsLoading } = useQuery<ConversationSummary[]>({
    queryKey: ["coach-conversations"],
    queryFn: async () => {
      const { data } = await api.get<ConversationSummary[]>("/api/coach-messages");
      return data;
    },
  });

  // Sync unread counts from API data - completely loop-free using functional updates
  useEffect(() => {
    if (conversations.length === 0) return;

    setUnreadCounts((prev) => {
      const counts: Record<string, number> = {};
      let hasChanged = false;
      for (const c of conversations) {
        counts[c.partnerId] = c.unreadCount;
        if (prev[c.partnerId] !== c.unreadCount) {
          hasChanged = true;
        }
      }
      if (hasChanged || Object.keys(prev).length !== conversations.length) {
        return counts;
      }
      return prev;
    });
  }, [conversations]);

  // Handle selected conversation initialization and query parameter sync
  useEffect(() => {
    if (conversations.length === 0) return;

    if (partnerFromUrl && conversations.some((c) => c.partnerId === partnerFromUrl)) {
      if (selectedId !== partnerFromUrl) {
        setSelectedId(partnerFromUrl);
      }
    } else if (!selectedId) {
      setSelectedId(conversations[0].partnerId);
    }
  }, [conversations, partnerFromUrl, selectedId]);

  useEffect(() => {
    setActiveCoachMessagesPartner(selectedId);
    return () => setActiveCoachMessagesPartner(null);
  }, [selectedId]);

  // ── Active thread messages ─────────────────────────────────────────────
  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: messagesLoading,
    prependMessage,
  } = useCoachMessages(selectedId ?? "");

  // ── Real-time socket ───────────────────────────────────────────────────
  const { sendMessage: socketSend, sendTranscription, isConnected } = useCoachSocket({
    onNewMessage: (msg: CoachMessageDTO) => {
      // Prepend to the active thread's cache
      if (selectedId && (msg.userId === selectedId || msg.coachId === selectedId)) {
        prependMessage(msg);
      }
      // Update unread count for the sender's thread
      const senderId = msg.senderRole === "member" ? msg.userId : msg.coachId;
      if (senderId !== selectedId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [senderId]: (prev[senderId] ?? 0) + 1,
        }));
      }
    },
    onReadReceipt: (data: { partnerId: string; readAt: string }) => {
      // Clear unread count for the partner who read our messages
      setUnreadCounts((prev) => ({ ...prev, [data.partnerId]: 0 }));
    },
    onError: (err: { code: string; message: string }) => {
      if (err.code === "SAVE_FAILED") {
        toast.error("Message failed to send. Please try again.");
      } else if (err.code === "UNAUTHORIZED_THREAD") {
        toast.error("You are not authorized to message this member.");
      }
    },
  });

  // ── Risk cache: load on partner change ───────────────────────────────────
  useEffect(() => {
    if (!selectedId) {
      setRiskByMessageId({});
      return;
    }
    setRiskByMessageId(loadRiskCache(selectedId));
  }, [selectedId]);

  // ── Merge API thread risk into cache when messages refresh ───────────────
  useEffect(() => {
    if (!selectedId || messages.length === 0) return;
    const fromApi: Record<string, MessageRiskMeta> = {};
    for (const msg of messages) {
      if (msg.senderRole !== "member") continue;
      const meta = riskFromMessageDto(msg);
      if (meta) fromApi[msg.id] = meta;
    }
    if (Object.keys(fromApi).length === 0) return;
    const merged = mergeRiskCache(selectedId, fromApi);
    setRiskByMessageId(merged);
  }, [selectedId, messages]);

  // ── Select conversation ────────────────────────────────────────────────
  const selectConversation = useCallback((partnerId: string) => {
    if (!partnerId) return;
    setSelectedId(partnerId);
    setInputText("");
    setActiveTab("messages");
    router.replace(`/messages?partner=${encodeURIComponent(partnerId)}`, { scroll: false });
    api.post(`/api/coach-messages/${partnerId}/read`).then(() => {
      setUnreadCounts((prev) => ({ ...prev, [partnerId]: 0 }));
      queryClient.invalidateQueries({ queryKey: ["coach-conversations"] });
    }).catch(() => { /* ignore */ });
  }, [queryClient, router]);

  // Reload per-message badges when shared store updates (SSE or other tab)
  useEffect(() => {
    return subscribeRiskDashboard(() => {
      if (selectedId) setRiskByMessageId(loadRiskCache(selectedId));
    });
  }, [selectedId]);

  useEffect(() => {
    if (!latestUpdate) return;
    setShowBanner(true);
    const hideBanner = setTimeout(() => setShowBanner(false), 8000);
    if (selectedId) {
      setRiskByMessageId(loadRiskCache(selectedId));
      // Refetch thread after vasl DB save completes (background task ~1–2s)
      const refetchThread = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["coach-messages", selectedId] });
      }, 2500);
      return () => {
        clearTimeout(hideBanner);
        clearTimeout(refetchThread);
      };
    }
    return () => clearTimeout(hideBanner);
  }, [latestUpdate, selectedId, queryClient]);

 // ── Scroll: instant on initial load, smooth for new socket messages ──────────
// ── Track last message count to detect new vs old messages loading ─────────
const prevMessageCountRef = useRef(0);
const isLoadingOlderRef = useRef(false);

// Mark when we're fetching older messages
useEffect(() => {
  if (isFetchingNextPage) {
    isLoadingOlderRef.current = true;
  }
}, [isFetchingNextPage]);

// ── Scroll: instant on initial load, smooth for new socket messages ──────────
const prevSelectedId = useRef<string | null>(null);

useEffect(() => {
  if (!chatEndRef.current || messages.length === 0) return;

  const conversationChanged = prevSelectedId.current !== selectedId;
  prevSelectedId.current = selectedId;

  if (conversationChanged) {
    // Instant jump when switching conversations or initial load
    prevMessageCountRef.current = messages.length;
    chatEndRef.current.scrollIntoView({ behavior: "instant" });
    return;
  }

  // If older messages just loaded (scroll up pagination) — don't scroll to bottom
  if (isLoadingOlderRef.current) {
    isLoadingOlderRef.current = false;
    prevMessageCountRef.current = messages.length;
    return; // preserve scroll position — handleChatScroll already handles it
  }

  // Only scroll to bottom if a NEW message was added (count increased by 1)
  const countDiff = messages.length - prevMessageCountRef.current;
  prevMessageCountRef.current = messages.length;

  if (countDiff === 1) {
    chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }
}, [messages, selectedId]);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    if (el.scrollTop < 60 && hasNextPage && !isFetchingNextPage) {
      const prevScrollHeight = el.scrollHeight;
      fetchNextPage();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || sending || !selectedId) return;
    setSending(true);
    socketSend(selectedId, text);
    setInputText("");
    setSending(false);
    inputRef.current?.focus();
  }, [inputText, sending, selectedId, socketSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleStartOrJoinVideo = useCallback((session: CoachSessionRow) => {
    setMeetingSessionId(session.id);
    setMeetingMemberId(session.memberId);
    setMeetingClientName(session.memberName);
    setMeetingSessionTime(formatSessionDate(session.date));
    setMeetingOpen(true);
  }, []);

  const selectedConv = conversations.find((c) => c.partnerId === selectedId);

  if (role === "user") {
    return (
      <DashboardLayout title="Messages">
        <p className="text-sm text-dim">Opening your coach chat…</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Messages">
      <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden rounded-card border border-line">

        {/* ── Client list ── */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-line bg-card">
          <div className="border-b border-line px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-dim">
            {convsLoading ? "Loading..." : `Clients (${conversations.length})`}
          </div>
          {convsLoading ? (
            <div className="p-4 text-sm text-dim">Loading conversations…</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-sm text-dim">No conversations yet.</div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.partnerId === selectedId;
              const unread = unreadCounts[conv.partnerId] ?? 0;
              return (
                <div
                  key={conv.partnerId}
                  onClick={() => selectConversation(conv.partnerId)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3.5 transition-colors",
                    isSelected ? "bg-sage-soft" : "hover:bg-canvas"
                  )}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-teal-light border border-line text-sm font-bold text-teal">
                      {conv.partnerName.charAt(0).toUpperCase()}
                    </div>
                    {unread > 0 && (
                      <div className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-card bg-terra px-0.5 text-[9px] font-bold text-white">
                        {unread > 9 ? "9+" : unread}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[13.5px] font-bold text-ink">{conv.partnerName}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-dim">{conv.lastMessage}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Chat panel ── */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Score update banner */}
          {showBanner && latestUpdate && (
            <div
              className="flex shrink-0 items-center gap-3 border-b-2 px-5 py-2.5"
              style={{
                background:   TIER_BG[latestUpdate.risk_tier]    ?? "#F5E6C8",
                borderColor:  TIER_COLORS[latestUpdate.risk_tier] ?? "#B8832A",
              }}
            >
              <span className="text-lg">
                {latestUpdate.risk_tier === "crisis" ? "🚨" : latestUpdate.risk_tier === "high" ? "⚠️" : "📊"}
              </span>
              <div className="flex-1 text-[13px]">
                <strong>{latestUpdate.client_name}</strong>
                {" — Risk updated: "}
                <strong style={{ color: TIER_COLORS[latestUpdate.risk_tier] }}>
                  {latestUpdate.risk_tier.toUpperCase()} ({(latestUpdate.risk_score * 100).toFixed(0)}%)
                </strong>
                {" · "}
                {latestUpdate.recommended_action?.replace(/_/g, " ")}
              </div>
              <button
                onClick={() => setShowBanner(false)}
                className="text-dim hover:text-ink"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {/* Chat header */}
          {selectedConv ? (
            <div className="flex shrink-0 items-center gap-3 bg-[var(--bg-surface-2)] border-b border-line px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-teal-light border border-line text-sm font-bold text-teal">
                {selectedConv.partnerName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">{selectedConv.partnerName}</div>
                <div className="text-xs text-dim">
                  <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", isConnected ? "bg-[var(--sage)]" : "bg-gray-400")} />
                  {isConnected ? "Connected" : "Connecting..."}
                </div>
              </div>
              <div className="flex gap-1 rounded-[10px] bg-[var(--bg-surface-2)] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("messages")}
                  className={cn(
                    "rounded-[7px] px-[18px] py-[7px] text-[13px] font-semibold outline-none transition-all",
                    activeTab === "messages"
                      ? "bg-card text-ink shadow-[0_1px_4px_rgba(60,50,40,0.1)]"
                      : "text-mid hover:text-ink"
                  )}
                >
                  Messages
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("sessions")}
                  className={cn(
                    "rounded-[7px] px-[18px] py-[7px] text-[13px] font-semibold outline-none transition-all",
                    activeTab === "sessions"
                      ? "bg-card text-ink shadow-[0_1px_4px_rgba(60,50,40,0.1)]"
                      : "text-mid hover:text-ink"
                  )}
                >
                  Sessions
                </button>
              </div>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-3 bg-[var(--bg-surface-2)] border-b border-line px-5 py-3.5">
              <div className="text-sm text-dim">Select a conversation</div>
            </div>
          )}

          {activeTab === "messages" ? (
            <>
              {/* Messages */}
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="flex flex-1 flex-col gap-3 overflow-y-auto bg-canvas p-4"
              >
                {!selectedId ? (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-dim">Select a conversation to start messaging.</p>
                  </div>
                ) : (
                  <>
                    {isFetchingNextPage && (
                      <div className="flex justify-center py-2">
                        <p className="text-xs text-dim">Loading older messages...</p>
                      </div>
                    )}
                    {messagesLoading ? (
                      <div className="flex flex-1 items-center justify-center">
                        <p className="text-sm text-dim">Loading messages…</p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center">
                        <p className="text-sm text-dim">No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages.flatMap((msg, i) => {
                        const msgRisk =
                          msg.senderRole === "member"
                            ? riskByMessageId[msg.id] ?? riskFromMessageDto(msg)
                            : null;
                        const topSignals = msgRisk?.signal_codes?.slice(0, 2) ?? [];
                        const showSeparator =
                          i === 0 || getDayKey(msg.createdAt) !== getDayKey(messages[i - 1].createdAt);
                        return [
                          showSeparator && (
                            <div key={`sep-${msg.id}`} className="my-3 flex items-center gap-3">
                              <div className="h-px flex-1 bg-line" />
                              <span className="px-2 text-[11px] font-medium text-dim">
                                {formatDateLabel(msg.createdAt)}
                              </span>
                              <div className="h-px flex-1 bg-line" />
                            </div>
                          ),
                          <div
                            key={msg.id}
                            className={cn(
                              "max-w-[72%]",
                              msg.senderRole === "coach" ? "self-end" : "self-start"
                            )}
                          >
                            <div
                              className={cn(
                                "rounded-[14px] px-4 py-2.5 text-[13.5px] leading-relaxed",
                                msg.senderRole === "coach"
                                  ? "rounded-br-sm bg-sage text-white"
                                  : "rounded-bl-sm border border-line bg-card text-ink shadow-sm"
                              )}
                            >
                              {msg.content}
                            </div>
                            {msgRisk && (() => {
                              const pill =
                                TIER_BADGE_PILL[msgRisk.risk_tier] ?? TIER_BADGE_PILL.low;
                              return (
                                <div
                                  className="risk-badge mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                  style={{ backgroundColor: pill.bg, color: pill.text }}
                                >
                                  <span>{TIER_EMOJI[msgRisk.risk_tier] ?? "🟢"}</span>
                                  <span>
                                    {msgRisk.risk_tier.toUpperCase()} (
                                    {(msgRisk.risk_score * 100).toFixed(0)}%)
                                    {topSignals.length > 0 && (
                                      <> • {topSignals.join(" ")}</>
                                    )}
                                  </span>
                                </div>
                              );
                            })()}
                            <div className={cn("mt-1 text-[10px] text-dim", msg.senderRole === "coach" && "text-right")}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>,
                        ].filter(Boolean);
                      })
                    )}
                  </>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex shrink-0 items-center gap-2 border-t border-line bg-card px-3.5 py-3">
                <input
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedConv ? `Message ${selectedConv.partnerName}...` : "Select a conversation..."}
                  className="flex-1 rounded-[22px] border-[1.5px] border-line bg-canvas px-4 py-2 text-[13.5px] text-ink outline-none focus:border-sage"
                  disabled={sending || !selectedId || !isConnected}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !inputText.trim() || !selectedId || !isConnected}
                  className={cn(
                    "rounded-[9px] px-5 py-2 text-[13.5px] font-semibold transition-colors",
                    sending || !inputText.trim() || !selectedId || !isConnected
                      ? "cursor-not-allowed bg-canvas text-dim"
                      : "bg-sage text-white hover:bg-sage/90"
                  )}
                >
                  {sending ? "..." : "Send"}
                </button>
              </div>
            </>
          ) : (
            /* Sessions Panel */
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-canvas p-4">
              {!selectedId ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-dim">Select a conversation to view sessions.</p>
                </div>
              ) : sessionsLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-dim">Loading sessions…</p>
                </div>
              ) : coachSessions.filter((s) => s.memberId === selectedId).length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-dim">No sessions scheduled with this client.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {coachSessions
                    .filter((s) => s.memberId === selectedId)
                    .map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between rounded-xl border border-line bg-card p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-sm font-semibold text-ink">
                            {formatSessionDate(session.date)}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-dim">
                            <span>{session.type}</span>
                            <span>•</span>
                            <span>{session.duration} min</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge variant={statusVariant(session.status)}>
                            {session.status}
                          </Badge>

                          {session.status !== "cancelled" && session.status !== "completed" && (
                            <Button
                              variant={session.livekitStartedAt ? "primary" : "outline"}
                              size="xs"
                              disabled={!!sessionRowLoading[session.id]}
                              onClick={() => handleStartOrJoinVideo(session)}
                            >
                              {sessionRowLoading[session.id]
                                ? "Loading..."
                                : session.livekitStartedAt
                                ? "Join Call"
                                : "Start Call"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: signals ── */}
        {selectedConv && scoreUpdates[selectedConv.partnerId] && (() => {
          const clientScore = scoreUpdates[selectedConv.partnerId];
          return (
            <div className="w-60 shrink-0 overflow-y-auto border-l border-line bg-card p-4">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-dim">
                Latest Inference
              </div>
              <div
                className="mb-4 rounded-xl py-4 text-center"
                style={{ background: TIER_BG[clientScore.risk_tier] }}
              >
                <div className="text-4xl font-extrabold leading-none" style={{ color: TIER_COLORS[clientScore.risk_tier] }}>
                  {(clientScore.risk_score * 100).toFixed(0)}%
                </div>
                <div className="mt-1 text-xs font-bold" style={{ color: TIER_COLORS[clientScore.risk_tier] }}>
                  {clientScore.risk_tier.toUpperCase()} RISK
                </div>
                <div className="mt-1 text-[11px] text-dim">Trend: {clientScore.risk_trend}</div>
              </div>
              <div className="mb-3 rounded-lg bg-canvas p-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-dim">
                  Recommended Action
                </div>
                <div className="text-[12.5px] font-semibold text-ink">
                  {clientScore.recommended_action?.replace(/_/g, " ") ?? "—"}
                </div>
              </div>
              {clientScore.active_signals?.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-dim">
                    Active Signals ({clientScore.active_signals.length})
                  </div>
                  {clientScore.active_signals.slice(0, 6).map((sig, i) => (
                    <div key={i} className="mb-2">
                      <div className="mb-1 flex justify-between">
                        <span className="text-[11.5px] font-semibold text-ink">{sig.signal_code}</span>
                        <span className="text-[11px] text-dim">{(sig.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width:      `${sig.confidence * 100}%`,
                            background: TIER_COLORS[clientScore.risk_tier],
                          }}
                        />
                      </div>
                      {sig.signal_label && (
                        <div className="mt-0.5 text-[10px] text-dim">{sig.signal_label}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 text-[10px] text-dim">
                Updated {new Date(clientScore.processed_at).toLocaleTimeString()}
              </div>
            </div>
          );
        })()}
      </div>
      {meetingOpen && meetingSessionId && meetingMemberId && (
        <MeetingModal
          sessionId={meetingSessionId}
          memberId={meetingMemberId}
          clientName={meetingClientName}
          sessionTime={meetingSessionTime}
          onMemberTranscription={(text) => {
            if (meetingMemberId) {
              sendTranscription(meetingMemberId, text, "member");
            }
          }}
          onClose={() => {
            setMeetingOpen(false);
            setMeetingSessionId(null);
            setMeetingMemberId(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
