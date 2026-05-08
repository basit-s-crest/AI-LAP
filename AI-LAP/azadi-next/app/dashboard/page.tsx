"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────
interface Signal {
  signal_code: string;
  signal_label: string | null;
  confidence: number;
  dimension: string | null;
}

interface ScoreUpdate {
  member_token: string;
  client_name: string;
  risk_tier: "low" | "moderate" | "high" | "crisis";
  risk_score: number;
  risk_trend: "stable" | "increasing" | "decreasing";
  recommended_action: string;
  active_signals: Signal[];
  processed_at: string;
}

interface HistoryEntry {
  score: number;
  tier: string;
  time: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
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

const TIER_EMOJI: Record<string, string> = {
  low: "🟢",
  moderate: "🟡",
  high: "🟠",
  crisis: "🔴",
};

// ── Dashboard Page ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  // Latest snapshot per member (for the score cards)
  const [scores, setScores] = useState<Record<string, ScoreUpdate>>({});
  // Score history per member (for sparklines)
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  // Activity feed
  const [events, setEvents] = useState<Array<{ text: string; time: string; tier: string }>>([]);
  // SSE state
  const [connected, setConnected] = useState(false);
  const [lastPing, setLastPing] = useState<string | null>(null);
  // Cumulative counters — stored in state so they trigger re-renders
  // Each incoming event increments the matching tier, never resets
  const [totalCount, setTotalCount] = useState(0);
  const [tierTotals, setTierTotals] = useState({ low: 0, moderate: 0, high: 0, crisis: 0 });

  // ── SSE connection ────────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource("/api/scores/stream");

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "connected") {
          setConnected(true);
          setLastPing(new Date().toLocaleTimeString());
          return;
        }

        if (data.type === "score_update" && data.payload) {
          const update: ScoreUpdate = data.payload;

          // 1. Increment total event count
          setTotalCount((n) => n + 1);

          // 2. Increment the matching tier counter (cumulative, never resets)
          setTierTotals((prev) => ({
            ...prev,
            [update.risk_tier]: (prev[update.risk_tier] ?? 0) + 1,
          }));

          // 3. Update latest score snapshot for this member
          setScores((prev) => ({ ...prev, [update.member_token]: update }));

          // 4. Append to sparkline history (keep last 20 per member)
          setHistory((prev) => {
            const existing = prev[update.member_token] ?? [];
            return {
              ...prev,
              [update.member_token]: [
                ...existing.slice(-19),
                {
                  score: update.risk_score,
                  tier: update.risk_tier,
                  time: new Date(update.processed_at).toLocaleTimeString(),
                },
              ],
            };
          });

          // 5. Prepend to activity log (keep last 50)
          setEvents((prev) => [
            {
              text: `${update.client_name} — ${update.risk_tier.toUpperCase()} (${(update.risk_score * 100).toFixed(0)}%)`,
              time: new Date().toLocaleTimeString(),
              tier: update.risk_tier,
            },
            ...prev.slice(0, 49),
          ]);

          setLastPing(new Date().toLocaleTimeString());
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  const scoreList = Object.values(scores).sort((a, b) => b.risk_score - a.risk_score);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#F4EFE6", fontFamily: "'Nunito', sans-serif" }}>

      {/* Topbar */}
      <div style={{ height: 58, padding: "0 32px", background: "#1E1A16", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#FDFAF5" }}>
            VASL Health
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.42)", letterSpacing: 1 }}>
            Live Risk Dashboard
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: connected ? "rgba(78,140,88,.2)" : "rgba(192,57,43,.2)", borderRadius: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#7AB882" : "#C0392B" }} />
            <span style={{ fontSize: 12, color: connected ? "#7AB882" : "#C0392B", fontWeight: 600 }}>
              {connected ? "SSE Connected" : "Disconnected"}
            </span>
          </div>
          {lastPing && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)", fontFamily: "'JetBrains Mono', monospace" }}>
              Last update: {lastPing}
            </span>
          )}
          <Link href="/member" style={{ padding: "7px 16px", background: "rgba(78,140,88,.25)", color: "#7AB882", borderRadius: 9, textDecoration: "none", fontSize: 13, fontWeight: 600, border: "1px solid rgba(78,140,88,.4)" }}>
            🌿 Member App
          </Link>
          <Link href="/coach/messages" style={{ padding: "7px 16px", background: "rgba(255,255,255,.08)", color: "#FDFAF5", borderRadius: 9, textDecoration: "none", fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,.15)" }}>
            ← Coach Messages
          </Link>
        </div>
      </div>

      <div style={{ padding: "28px 32px" }}>

        {/* ── Stats row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total Analysed", value: totalCount,          color: "#4E8C58", bg: "#D4EDD7" },
            { label: "Crisis",         value: tierTotals.crisis,   color: "#C0392B", bg: "#FAE0DC" },
            { label: "High Risk",      value: tierTotals.high,     color: "#B35A38", bg: "#F5DDD4" },
            { label: "Moderate",       value: tierTotals.moderate, color: "#B8832A", bg: "#F5E6C8" },
            { label: "Low Risk",       value: tierTotals.low,      color: "#4E8C58", bg: "#D4EDD7" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "#FDFAF5", border: "1.5px solid rgba(60,50,40,.10)", borderRadius: 14, padding: 20, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: stat.color, borderRadius: "14px 14px 0 0" }} />
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1.2, color: "#9C9188", marginBottom: 10, fontWeight: 700 }}>
                {stat.label}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* ── Member score cards ── */}
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: "#1E1A16", marginBottom: 14 }}>
              Member Risk Scores
            </div>

            {scoreList.length === 0 ? (
              <div style={{ background: "#FDFAF5", border: "1.5px solid rgba(60,50,40,.10)", borderRadius: 14, padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#1E1A16", marginBottom: 8 }}>
                  Waiting for inference results
                </div>
                <div style={{ fontSize: 13, color: "#9C9188", lineHeight: 1.7, marginBottom: 20 }}>
                  Go to the <strong>Member App</strong>, sign in as Amara, navigate to<br />
                  <strong>Coaching → select a coach → Message</strong> and send a message.<br />
                  Scores will appear here in real-time via SSE.
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <Link href="/member" style={{ padding: "10px 22px", background: "#4E8C58", color: "white", borderRadius: 9, textDecoration: "none", fontSize: 13.5, fontWeight: 700 }}>
                    🌿 Open Member App →
                  </Link>
                </div>
              </div>
            ) : (
              scoreList.map((s) => {
                const hist = history[s.member_token] ?? [];
                const maxScore = Math.max(...hist.map((h) => h.score), 0.01);
                return (
                  <div
                    key={s.member_token}
                    style={{ background: "#FDFAF5", border: `1.5px solid ${TIER_COLORS[s.risk_tier]}40`, borderRadius: 14, padding: 20, marginBottom: 14 }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: "#1E1A16" }}>{s.client_name}</div>
                        <div style={{ fontSize: 11, color: "#9C9188", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                          {s.member_token.slice(0, 22)}...
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 32, fontWeight: 800, color: TIER_COLORS[s.risk_tier], lineHeight: 1 }}>
                          {(s.risk_score * 100).toFixed(0)}%
                        </div>
                        <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, background: TIER_BG[s.risk_tier], color: TIER_COLORS[s.risk_tier], fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                          {TIER_EMOJI[s.risk_tier]} {s.risk_tier.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Sparkline — shows score history across all messages */}
                    {hist.length > 1 && (
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40, marginBottom: 12 }}>
                        {hist.map((h, i) => (
                          <div
                            key={i}
                            title={`${(h.score * 100).toFixed(0)}% at ${h.time}`}
                            style={{
                              flex: 1,
                              height: `${(h.score / maxScore) * 100}%`,
                              minHeight: 3,
                              background: TIER_COLORS[h.tier] ?? "#4E8C58",
                              borderRadius: "2px 2px 0 0",
                              opacity: i === hist.length - 1 ? 1 : 0.5,
                              transition: "height .3s ease",
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: "#5C5248" }}>
                        <span style={{ fontWeight: 700 }}>Trend:</span> {s.risk_trend}
                      </div>
                      <div style={{ fontSize: 12, color: "#5C5248" }}>
                        <span style={{ fontWeight: 700 }}>Action:</span> {s.recommended_action?.replace(/_/g, " ")}
                      </div>
                    </div>

                    {s.active_signals?.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {s.active_signals.slice(0, 5).map((sig, i) => (
                          <span key={i} style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 5, background: "#F0EBE1", color: "#5C5248", fontWeight: 600 }}>
                            {sig.signal_code} {(sig.confidence * 100).toFixed(0)}%
                          </span>
                        ))}
                        {s.active_signals.length > 5 && (
                          <span style={{ fontSize: 10.5, color: "#9C9188" }}>+{s.active_signals.length - 5} more</span>
                        )}
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: "#9C9188", marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                      Updated {new Date(s.processed_at).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Activity log ── */}
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: "#1E1A16", marginBottom: 14 }}>
              Live Activity Log
            </div>
            <div style={{ background: "#FDFAF5", border: "1.5px solid rgba(60,50,40,.10)", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(60,50,40,.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#9C9188", fontWeight: 700 }}>{events.length} events</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#2E7D4F" : "#9C9188" }} />
                  <span style={{ fontSize: 11, color: "#9C9188" }}>{connected ? "Live" : "Offline"}</span>
                </div>
              </div>
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {events.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#9C9188", fontSize: 13 }}>
                    No events yet. Open the Member App and send a message to a coach.
                  </div>
                ) : (
                  events.map((ev, i) => (
                    <div
                      key={i}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: "1px solid rgba(60,50,40,.06)" }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: TIER_BG[ev.tier] ?? "#F0EBE1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                        {TIER_EMOJI[ev.tier] ?? "📊"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#1E1A16" }}>{ev.text}</div>
                        <div style={{ fontSize: 10, color: "#9C9188", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{ev.time}</div>
                      </div>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: TIER_BG[ev.tier], color: TIER_COLORS[ev.tier], fontWeight: 700 }}>
                        {ev.tier}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* How it works */}
            <div style={{ background: "#1E1A16", borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7AB882", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
                How it works
              </div>
              {[
                { step: "1", text: "Member opens /member, signs in as Amara" },
                { step: "2", text: "Coaching → select coach → type a message → Send" },
                { step: "3", text: "Injected script silently POSTs to /api/chat (BullMQ)" },
                { step: "4", text: "Worker dequeues → FastAPI /v1/ingest/chat → LLM" },
                { step: "5", text: "LLM returns risk tier + signals → saved to PostgreSQL" },
                { step: "6", text: "Worker publishes to Redis → SSE → dashboard updates" },
              ].map((s) => (
                <div key={s.step} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#4E8C58", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>
                    {s.step}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(253,250,245,.65)", lineHeight: 1.5 }}>{s.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  );
}
