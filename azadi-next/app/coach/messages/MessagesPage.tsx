"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

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

interface ScoreUpdate {
  member_token: string;
  client_name: string;
  risk_tier: "low" | "moderate" | "high" | "crisis";
  risk_score: number;
  risk_trend: string;
  recommended_action: string;
  active_signals: Array<{ signal_code: string; signal_label: string; confidence: number }>;
  processed_at: string;
}

// ── Static client data (matches the 4 shown in the HTML prototype) ─────────
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
    memberToken: "mbr_marcus_001",
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
    memberToken: "mbr_priya_001",
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
    memberToken: "mbr_jordan_001",
    sessionId: "sess_jordan_001",
    lastMessage: "Last message 5d ago",
    unread: false,
    status: "offline",
  },
];

const INITIAL_MSGS: Record<string, ChatMessage[]> = {
  "1": [
    { id: "m1", role: "user", name: "Amara J.", text: "Hi Dr. Osei, I've been feeling anxious ahead of my presentation.", time: "10:32 AM" },
    { id: "m2", role: "coach", name: "You", text: "I hear you. Let's work through some grounding techniques.", time: "10:34 AM" },
    { id: "m3", role: "user", name: "Amara J.", text: "That would be really helpful, thank you.", time: "10:35 AM" },
  ],
  "2": [
    { id: "m4", role: "user", name: "Marcus T.", text: "I've been struggling to sleep lately.", time: "Yesterday" },
    { id: "m5", role: "coach", name: "You", text: "Let's talk about your sleep hygiene. What time are you usually going to bed?", time: "Yesterday" },
  ],
  "3": [
    { id: "m6", role: "user", name: "Priya N.", text: "I feel disconnected from my family.", time: "3d ago" },
  ],
  "4": [
    { id: "m7", role: "user", name: "Jordan W.", text: "I don't know how much longer I can keep going like this.", time: "5d ago" },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  low: "#4E8C58",
  moderate: "#B8832A",
  high: "#B35A38",
  crisis: "#C0392B",
};

const TIER_BG: Record<string, string> = {
  low: "#D4EDD7",
  moderate: "#F5E6C8",
  high: "#F5DDD4",
  crisis: "#FAE0DC",
};

function formatTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function MessagesPage() {
  const [selectedId, setSelectedId] = useState<string>("1");
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(INITIAL_MSGS);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [scoreUpdates, setScoreUpdates] = useState<Record<string, ScoreUpdate>>({});
  const [latestUpdate, setLatestUpdate] = useState<ScoreUpdate | null>(null);
  const [showScoreBanner, setShowScoreBanner] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedClient = CLIENTS.find((c) => c.id === selectedId)!;

  // ── SSE: subscribe to score updates ──────────────────────────────────────
  useEffect(() => {
    const es = new EventSource("/api/scores/stream");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "score_update" && data.payload) {
          const update: ScoreUpdate = data.payload;
          setScoreUpdates((prev) => ({ ...prev, [update.member_token]: update }));
          setLatestUpdate(update);
          setShowScoreBanner(true);
          setTimeout(() => setShowScoreBanner(false), 8000);
        }
      } catch {}
    };

    es.onerror = () => {
      // SSE will auto-reconnect; silently ignore
    };

    return () => es.close();
  }, []);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedId]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    const client = CLIENTS.find((c) => c.id === selectedId)!;
    const msgId = `msg_${Date.now()}`;

    // Optimistically add coach message
    const coachMsg: ChatMessage = {
      id: msgId,
      role: "coach",
      name: "You",
      text,
      time: formatTime(),
    };

    setMessages((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] ?? []), coachMsg],
    }));
    setInputText("");
    setSending(true);

    // Only enqueue for Amara (first client) — as per the task requirement
    if (client.id === "1") {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_token: client.memberToken,
            session_id: client.sessionId,
            text,
            client_name: client.name,
            org_id: "org_univ_maryland",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // Add a system note that inference is running
          const sysMsg: ChatMessage = {
            id: `sys_${Date.now()}`,
            role: "user",
            name: "System",
            text: `🔄 Analysing message... (job ${data.job_id?.slice(0, 8) ?? "queued"})`,
            time: formatTime(),
            pending: true,
          };
          setMessages((prev) => ({
            ...prev,
            [selectedId]: [...(prev[selectedId] ?? []), sysMsg],
          }));
        }
      } catch (err) {
        console.error("Failed to enqueue:", err);
      }
    }

    setSending(false);
    inputRef.current?.focus();
  }, [inputText, sending, selectedId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Score for selected client ─────────────────────────────────────────────
  const clientScore = scoreUpdates[selectedClient.memberToken];

  return (
    <div style={{ display: "flex", height: "100vh", background: "#F4EFE6", fontFamily: "'Nunito', sans-serif" }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 240, background: "#1E1A16", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* Brand */}
        <div style={{ padding: "24px 22px 18px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 700, color: "#FDFAF5" }}>
            Azadi Health
          </div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.32)", letterSpacing: 2, textTransform: "uppercase", marginTop: 3 }}>
            Coach Portal
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 0" }}>
          {[
            { label: "Dashboard", icon: "◈", href: "/" },
            { label: "Messages", icon: "◐", href: "/coach/messages", active: true, badge: 2 },
            { label: "Live Dashboard", icon: "📊", href: "/dashboard" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 22px",
                color: item.active ? "#FDFAF5" : "rgba(255,255,255,.48)",
                background: item.active ? "rgba(78,140,88,.18)" : "transparent",
                borderLeft: item.active ? "2.5px solid #7AB882" : "2.5px solid transparent",
                textDecoration: "none",
                fontSize: 13.5,
                transition: "all .15s",
              }}
            >
              <span style={{ width: 18, textAlign: "center" }}>{item.icon}</span>
              {item.label}
              {item.badge ? (
                <span style={{ marginLeft: "auto", background: "#B35A38", color: "white", fontSize: 9, padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "14px 22px 18px", borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#3A6E99", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white" }}>
              D
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#FDFAF5" }}>Dr. Osei</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.28)" }}>Coach</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar */}
        <div style={{ height: 58, padding: "0 32px", background: "#FDFAF5", borderBottom: "1.5px solid rgba(60,50,40,.10)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "#1E1A16" }}>
            Messages
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/dashboard" style={{ padding: "7px 16px", background: "#4E8C58", color: "white", borderRadius: 9, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
              📊 Live Dashboard
            </Link>
          </div>
        </div>

        {/* Score update banner */}
        {showScoreBanner && latestUpdate && (
          <div
            className="fade-in"
            style={{
              padding: "10px 32px",
              background: TIER_BG[latestUpdate.risk_tier] ?? "#F5E6C8",
              borderBottom: `2px solid ${TIER_COLORS[latestUpdate.risk_tier] ?? "#B8832A"}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 18 }}>
              {latestUpdate.risk_tier === "crisis" ? "🚨" : latestUpdate.risk_tier === "high" ? "⚠️" : "📊"}
            </span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{latestUpdate.client_name}</span>
              <span style={{ color: "#5C5248", fontSize: 13 }}>
                {" "}— Risk score updated:{" "}
                <strong style={{ color: TIER_COLORS[latestUpdate.risk_tier] }}>
                  {latestUpdate.risk_tier.toUpperCase()} ({(latestUpdate.risk_score * 100).toFixed(0)}%)
                </strong>
                {" "}· {latestUpdate.recommended_action?.replace(/_/g, " ")}
              </span>
            </div>
            <button
              onClick={() => setShowScoreBanner(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9C9188" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Content: client list + chat */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Client list */}
          <div style={{ width: 280, background: "#FDFAF5", borderRight: "1.5px solid rgba(60,50,40,.10)", overflow: "auto", flexShrink: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(60,50,40,.08)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#9C9188", fontWeight: 700 }}>
              Clients ({CLIENTS.length})
            </div>
            {CLIENTS.map((client) => {
              const score = scoreUpdates[client.memberToken];
              const isSelected = client.id === selectedId;
              return (
                <div
                  key={client.id}
                  onClick={() => setSelectedId(client.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    borderBottom: "1px solid rgba(60,50,40,.08)",
                    cursor: "pointer",
                    background: isSelected ? "#EBF5EC" : "transparent",
                    transition: "background .15s",
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: client.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, position: "relative" }}>
                    {client.emoji}
                    {client.unread && (
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#B35A38", border: "2px solid #FDFAF5", position: "absolute", top: -2, right: -2 }} />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#1E1A16" }}>{client.name}</div>
                      {score && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 6,
                          background: TIER_BG[score.risk_tier],
                          color: TIER_COLORS[score.risk_tier],
                        }}>
                          {score.risk_tier.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#9C9188", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {client.id === "1" ? "🔄 LLM inference active" : client.lastMessage}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat panel */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Chat header */}
            <div style={{ padding: "14px 20px", background: "#1E1A16", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: selectedClient.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                {selectedClient.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#FDFAF5", fontSize: 14, fontWeight: 600 }}>{selectedClient.name}</div>
                <div style={{ color: "rgba(253,250,245,.42)", fontSize: 12 }}>
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: selectedClient.status === "active" ? "#2E7D4F" : selectedClient.status === "away" ? "#B8832A" : "#9C9188", marginRight: 5 }} />
                  {selectedClient.status === "active" ? "Active now" : selectedClient.status === "away" ? "Away" : "Offline"}
                  {selectedClient.id === "1" && " · Messages analysed by LLM via BullMQ"}
                </div>
              </div>

              {/* Live score badge */}
              {clientScore && (
                <div style={{
                  padding: "6px 14px",
                  borderRadius: 10,
                  background: TIER_BG[clientScore.risk_tier],
                  border: `1.5px solid ${TIER_COLORS[clientScore.risk_tier]}`,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, color: "#9C9188", fontWeight: 700, letterSpacing: 1 }}>RISK SCORE</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: TIER_COLORS[clientScore.risk_tier], lineHeight: 1.2 }}>
                    {(clientScore.risk_score * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: TIER_COLORS[clientScore.risk_tier] }}>
                    {clientScore.risk_tier.toUpperCase()}
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12, background: "#F4EFE6" }}>
              {(messages[selectedId] ?? []).map((msg) => (
                <div
                  key={msg.id}
                  className="fade-in"
                  style={{
                    maxWidth: "72%",
                    alignSelf: msg.role === "coach" ? "flex-end" : "flex-start",
                    opacity: msg.pending ? 0.65 : 1,
                  }}
                >
                  {msg.name !== "You" && msg.name !== "System" && (
                    <div style={{ fontSize: 11, color: "#9C9188", marginBottom: 3, marginLeft: 4 }}>{msg.name}</div>
                  )}
                  <div style={{
                    padding: "10px 15px",
                    borderRadius: 14,
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    background: msg.role === "coach" ? "#4E8C58" : msg.pending ? "#EDE7DC" : "#FDFAF5",
                    color: msg.role === "coach" ? "white" : "#1E1A16",
                    borderBottomRightRadius: msg.role === "coach" ? 4 : 14,
                    borderBottomLeftRadius: msg.role === "user" ? 4 : 14,
                    boxShadow: msg.role === "user" ? "0 2px 6px rgba(60,50,40,.07)" : "none",
                    fontStyle: msg.pending ? "italic" : "normal",
                  }}>
                    {msg.text}
                  </div>
                  <div style={{ fontSize: 10, color: "#9C9188", marginTop: 3, textAlign: msg.role === "coach" ? "right" : "left" }}>
                    {msg.time}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 14px", background: "#FDFAF5", borderTop: "1.5px solid rgba(60,50,40,.10)", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {selectedClient.id === "1" && (
                <div style={{ fontSize: 11, color: "#4E8C58", fontWeight: 600, padding: "4px 10px", background: "#EBF5EC", borderRadius: 6, flexShrink: 0 }}>
                  🔄 BullMQ
                </div>
              )}
              <input
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedClient.id === "1" ? "Message Amara — will be analysed by LLM..." : `Message ${selectedClient.name}...`}
                style={{
                  flex: 1,
                  padding: "9px 15px",
                  borderRadius: 22,
                  border: "1.5px solid rgba(60,50,40,.12)",
                  background: "#F4EFE6",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 13.5,
                  color: "#1E1A16",
                  outline: "none",
                }}
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !inputText.trim()}
                style={{
                  padding: "9px 20px",
                  background: sending || !inputText.trim() ? "#EDE7DC" : "#4E8C58",
                  color: sending || !inputText.trim() ? "#9C9188" : "white",
                  border: "none",
                  borderRadius: 9,
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: sending || !inputText.trim() ? "not-allowed" : "pointer",
                  transition: "all .18s",
                }}
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>

          {/* Right panel: signals */}
          {clientScore && (
            <div style={{ width: 260, background: "#FDFAF5", borderLeft: "1.5px solid rgba(60,50,40,.10)", overflow: "auto", flexShrink: 0, padding: 16 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#9C9188", fontWeight: 700, marginBottom: 12 }}>
                Latest Inference
              </div>

              {/* Score ring */}
              <div style={{ textAlign: "center", marginBottom: 16, padding: "16px 0", background: TIER_BG[clientScore.risk_tier], borderRadius: 12 }}>
                <div style={{ fontSize: 42, fontWeight: 800, color: TIER_COLORS[clientScore.risk_tier], lineHeight: 1 }}>
                  {(clientScore.risk_score * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: TIER_COLORS[clientScore.risk_tier], marginTop: 4 }}>
                  {clientScore.risk_tier.toUpperCase()} RISK
                </div>
                <div style={{ fontSize: 11, color: "#9C9188", marginTop: 4 }}>
                  Trend: {clientScore.risk_trend}
                </div>
              </div>

              {/* Action */}
              <div style={{ marginBottom: 14, padding: "10px 12px", background: "#F4EFE6", borderRadius: 9 }}>
                <div style={{ fontSize: 10, color: "#9C9188", fontWeight: 700, marginBottom: 4 }}>RECOMMENDED ACTION</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1E1A16" }}>
                  {clientScore.recommended_action?.replace(/_/g, " ") ?? "—"}
                </div>
              </div>

              {/* Signals */}
              {clientScore.active_signals?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#9C9188", fontWeight: 700, marginBottom: 8 }}>
                    Active Signals ({clientScore.active_signals.length})
                  </div>
                  {clientScore.active_signals.slice(0, 6).map((sig, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#1E1A16" }}>{sig.signal_code}</span>
                        <span style={{ fontSize: 11, color: "#9C9188" }}>{(sig.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 4, background: "#EDE7DC", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${sig.confidence * 100}%`, background: TIER_COLORS[clientScore.risk_tier], borderRadius: 2 }} />
                      </div>
                      {sig.signal_label && (
                        <div style={{ fontSize: 10, color: "#9C9188", marginTop: 2 }}>{sig.signal_label}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 10, color: "#9C9188", marginTop: 12 }}>
                Updated {new Date(clientScore.processed_at).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
