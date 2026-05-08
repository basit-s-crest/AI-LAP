"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/cn";
import type { ScoreUpdateEvent } from "@/lib/vasl/types";

// ── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "coach" | "user";
  name: string;
  text: string;
  time: string;
  pending?: boolean;
}

interface Client {
  id: string;
  name: string;
  emoji: string;
  bg: string;
  memberToken: string;
  sessionId: string;
  lastMessage: string;
  unread: boolean;
  status: "active" | "away" | "offline";
}

// ── Static client data ─────────────────────────────────────────────────────
const CLIENTS: Client[] = [
  {
    id: "1",
    name: "Amara Johnson",
    emoji: "🌿",
    bg: "#D4EDD7",
    memberToken: process.env.NEXT_PUBLIC_MEMBER_TOKEN_AMARA ?? "mbr_bf18c4d442624cd09a06",
    sessionId: "sess_amara_001",
    lastMessage: "Thank you so much, that really helps...",
    unread: true,
    status: "active",
  },
  {
    id: "2",
    name: "Marcus Thompson",
    emoji: "🌱",
    bg: "#D4E8F5",
    memberToken: process.env.NEXT_PUBLIC_MEMBER_TOKEN_MARCUS ?? "mbr_marcus_001",
    sessionId: "sess_marcus_001",
    lastMessage: "Last message 2d ago",
    unread: true,
    status: "away",
  },
  {
    id: "3",
    name: "Priya Nair",
    emoji: "🌻",
    bg: "#F5E6C8",
    memberToken: process.env.NEXT_PUBLIC_MEMBER_TOKEN_PRIYA ?? "mbr_priya_001",
    sessionId: "sess_priya_001",
    lastMessage: "Last message 3d ago",
    unread: false,
    status: "offline",
  },
  {
    id: "4",
    name: "Jordan Wells",
    emoji: "🌊",
    bg: "#FAE0DC",
    memberToken: process.env.NEXT_PUBLIC_MEMBER_TOKEN_JORDAN ?? "mbr_jordan_001",
    sessionId: "sess_jordan_001",
    lastMessage: "Last message 5d ago",
    unread: false,
    status: "offline",
  },
];

const INITIAL_MSGS: Record<string, ChatMessage[]> = {
  "1": [
    { id: "m1", role: "user",  name: "Amara J.", text: "Hi Dr. Osei, I've been feeling anxious ahead of my presentation.", time: "10:32 AM" },
    { id: "m2", role: "coach", name: "You",      text: "I hear you. Let's work through some grounding techniques.", time: "10:34 AM" },
    { id: "m3", role: "user",  name: "Amara J.", text: "That would be really helpful, thank you.", time: "10:35 AM" },
  ],
  "2": [
    { id: "m4", role: "user",  name: "Marcus T.", text: "I've been struggling to sleep lately.", time: "Yesterday" },
    { id: "m5", role: "coach", name: "You",       text: "Let's talk about your sleep hygiene. What time are you usually going to bed?", time: "Yesterday" },
  ],
  "3": [
    { id: "m6", role: "user", name: "Priya N.", text: "I feel disconnected from my family.", time: "3d ago" },
  ],
  "4": [
    { id: "m7", role: "user", name: "Jordan W.", text: "I don't know how much longer I can keep going like this.", time: "5d ago" },
  ],
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

function formatTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CoachMessagesPage() {
  const [selectedId, setSelectedId]     = useState<string>("1");
  const [messages, setMessages]         = useState<Record<string, ChatMessage[]>>(INITIAL_MSGS);
  const [inputText, setInputText]       = useState("");
  const [sending, setSending]           = useState(false);
  const [scoreUpdates, setScoreUpdates] = useState<Record<string, ScoreUpdateEvent>>({});
  const [latestUpdate, setLatestUpdate] = useState<ScoreUpdateEvent | null>(null);
  const [showBanner, setShowBanner]     = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  const selectedClient = CLIENTS.find((c) => c.id === selectedId)!;

  // ── SSE: subscribe to score updates ──────────────────────────────────────
  useEffect(() => {
    const es = new EventSource("/api/scores/stream");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "score_update" && data.payload) {
          const update: ScoreUpdateEvent = data.payload;
          setScoreUpdates((prev) => ({ ...prev, [update.member_token]: update }));
          setLatestUpdate(update);
          setShowBanner(true);
          setTimeout(() => setShowBanner(false), 8000);
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => { /* SSE auto-reconnects */ };
    return () => es.close();
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedId]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    const client = CLIENTS.find((c) => c.id === selectedId)!;
    const msgId  = `msg_${Date.now()}`;

    setMessages((prev) => ({
      ...prev,
      [selectedId]: [
        ...(prev[selectedId] ?? []),
        { id: msgId, role: "coach", name: "You", text, time: formatTime() },
      ],
    }));
    setInputText("");
    setSending(true);

    // Only enqueue for Amara (client 1) — LLM inference active
    if (client.id === "1") {
      try {
        const res = await fetch("/api/chat", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_token: client.memberToken,
            session_id:   client.sessionId,
            text,
            client_name:  client.name,
            org_id:       process.env.NEXT_PUBLIC_ORG_ID ?? "org_univ_maryland",
          }),
        });
        if (res.ok) {
          const j = await res.json();
          console.log("[chat] enqueued for inference:", j.event_id);
        }
      } catch (err) {
        console.error("Failed to enqueue:", err);
      }
    }

    setSending(false);
    inputRef.current?.focus();
  }, [inputText, sending, selectedId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clientScore = scoreUpdates[selectedClient.memberToken];

  return (
    <DashboardLayout title="Messages">
      <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden rounded-card border border-line">

        {/* ── Client list ── */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-line bg-card">
          <div className="border-b border-line px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-dim">
            Clients ({CLIENTS.length})
          </div>
          {CLIENTS.map((client) => {
            const score      = scoreUpdates[client.memberToken];
            const isSelected = client.id === selectedId;
            return (
              <div
                key={client.id}
                onClick={() => setSelectedId(client.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3.5 transition-colors",
                  isSelected ? "bg-sage-soft" : "hover:bg-canvas"
                )}
              >
                <div className="relative shrink-0">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lg"
                    style={{ background: client.bg }}
                  >
                    {client.emoji}
                  </div>
                  {client.unread && (
                    <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-terra" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-bold text-ink">{client.name}</span>
                    {score && (
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: TIER_BG[score.risk_tier], color: TIER_COLORS[score.risk_tier] }}
                      >
                        {score.risk_tier.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-dim">
                    {client.id === "1" ? "🔄 LLM inference active" : client.lastMessage}
                  </div>
                </div>
              </div>
            );
          })}
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
          <div className="flex shrink-0 items-center gap-3 bg-sidebar px-5 py-3.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-lg"
              style={{ background: selectedClient.bg }}
            >
              {selectedClient.emoji}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#FDFAF5]">{selectedClient.name}</div>
              <div className="text-xs text-[#FDFAF5]/40">
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full"
                  style={{
                    background:
                      selectedClient.status === "active" ? "#2E7D4F"
                      : selectedClient.status === "away"  ? "#B8832A"
                      : "#9C9188",
                  }}
                />
                {selectedClient.status === "active" ? "Active now"
                  : selectedClient.status === "away" ? "Away"
                  : "Offline"}
                {selectedClient.id === "1" && " · Messages analysed by LLM via BullMQ"}
              </div>
            </div>
            {/* Live risk badge */}
            {clientScore && (
              <div
                className="rounded-[10px] border px-3 py-1.5 text-center"
                style={{
                  background:  TIER_BG[clientScore.risk_tier],
                  borderColor: TIER_COLORS[clientScore.risk_tier],
                }}
              >
                <div className="text-[9px] font-bold uppercase tracking-widest text-dim">Risk Score</div>
                <div className="text-lg font-extrabold leading-tight" style={{ color: TIER_COLORS[clientScore.risk_tier] }}>
                  {(clientScore.risk_score * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] font-bold" style={{ color: TIER_COLORS[clientScore.risk_tier] }}>
                  {clientScore.risk_tier.toUpperCase()}
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-canvas p-4">
            {(messages[selectedId] ?? []).map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[72%]",
                  msg.role === "coach" ? "self-end" : "self-start",
                  msg.pending && "opacity-60"
                )}
              >
                {msg.name !== "You" && (
                  <div className="mb-1 ml-1 text-[11px] text-dim">{msg.name}</div>
                )}
                <div
                  className={cn(
                    "rounded-[14px] px-4 py-2.5 text-[13.5px] leading-relaxed",
                    msg.role === "coach"
                      ? "rounded-br-sm bg-sage text-white"
                      : "rounded-bl-sm border border-line bg-card text-ink shadow-sm",
                    msg.pending && "italic"
                  )}
                >
                  {msg.text}
                </div>
                <div className={cn("mt-1 text-[10px] text-dim", msg.role === "coach" && "text-right")}>
                  {msg.time}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex shrink-0 items-center gap-2 border-t border-line bg-card px-3.5 py-3">
            {selectedClient.id === "1" && (
              <span className="shrink-0 rounded-md bg-sage-soft px-2.5 py-1 text-[11px] font-semibold text-sage">
                🔄 BullMQ
              </span>
            )}
            <input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedClient.id === "1"
                  ? "Message Amara — will be analysed by LLM..."
                  : `Message ${selectedClient.name}...`
              }
              className="flex-1 rounded-[22px] border-[1.5px] border-line bg-canvas px-4 py-2 text-[13.5px] text-ink outline-none focus:border-sage"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !inputText.trim()}
              className={cn(
                "rounded-[9px] px-5 py-2 text-[13.5px] font-semibold transition-colors",
                sending || !inputText.trim()
                  ? "cursor-not-allowed bg-canvas text-dim"
                  : "bg-sage text-white hover:bg-sage/90"
              )}
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>

        {/* ── Right panel: signals ── */}
        {clientScore && (
          <div className="w-60 shrink-0 overflow-y-auto border-l border-line bg-card p-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-dim">
              Latest Inference
            </div>

            {/* Score ring */}
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

            {/* Recommended action */}
            <div className="mb-3 rounded-lg bg-canvas p-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-dim">
                Recommended Action
              </div>
              <div className="text-[12.5px] font-semibold text-ink">
                {clientScore.recommended_action?.replace(/_/g, " ") ?? "—"}
              </div>
            </div>

            {/* Active signals */}
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
        )}
      </div>
    </DashboardLayout>
  );
}
