"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import type { ScoreUpdateEvent } from "@/lib/vasl/types";

// ── Types ──────────────────────────────────────────────────────────────────
interface HistoryEntry {
  score: number;
  tier:  string;
  time:  string;
}

interface PersistedState {
  scores:     Record<string, ScoreUpdateEvent>;
  history:    Record<string, HistoryEntry[]>;
  events:     Array<{ text: string; time: string; tier: string }>;
  totalCount: number;
  tierTotals: { low: number; moderate: number; high: number; crisis: number };
}

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "vasl_risk_dashboard_v1";

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
const TIER_EMOJI: Record<string, string> = {
  low:      "🟢",
  moderate: "🟡",
  high:     "🟠",
  crisis:   "🔴",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch { /* ignore */ }
  return {
    scores:     {},
    history:    {},
    events:     [],
    totalCount: 0,
    tierTotals: { low: 0, moderate: 0, high: 0, crisis: 0 },
  };
}

// ── Empty defaults (used for SSR and initial client render) ───────────────
const EMPTY_STATE: PersistedState = {
  scores:     {},
  history:    {},
  events:     [],
  totalCount: 0,
  tierTotals: { low: 0, moderate: 0, high: 0, crisis: 0 },
};

// ── Page ───────────────────────────────────────────────────────────────────
export default function RiskDashboardPage() {
  // Always start with empty defaults so server and client render identically,
  // then hydrate from localStorage in a useEffect (after mount).
  const [scores, setScores]         = useState<Record<string, ScoreUpdateEvent>>(EMPTY_STATE.scores);
  const [history, setHistory]       = useState<Record<string, HistoryEntry[]>>(EMPTY_STATE.history);
  const [events, setEvents]         = useState<Array<{ text: string; time: string; tier: string }>>(EMPTY_STATE.events);
  const [connected, setConnected]   = useState(false);
  const [lastPing, setLastPing]     = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(EMPTY_STATE.totalCount);
  const [tierTotals, setTierTotals] = useState(EMPTY_STATE.tierTotals);

  // Restore persisted state after mount (client-only, avoids SSR mismatch)
  useEffect(() => {
    const saved = loadPersistedState();
    setScores(saved.scores);
    setHistory(saved.history);
    setEvents(saved.events);
    setTotalCount(saved.totalCount);
    setTierTotals(saved.tierTotals);
  }, []);

  // ── Persist to localStorage whenever state changes ────────────────────────
  useEffect(() => {
    try {
      const state: PersistedState = { scores, history, events, totalCount, tierTotals };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* quota exceeded or SSR — ignore */ }
  }, [scores, history, events, totalCount, tierTotals]);

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
          const update: ScoreUpdateEvent = data.payload;

          setTotalCount((n) => n + 1);
          setTierTotals((prev) => ({
            ...prev,
            [update.risk_tier]: (prev[update.risk_tier] ?? 0) + 1,
          }));
          setScores((prev) => ({ ...prev, [update.member_token]: update }));
          setHistory((prev) => {
            const existing = prev[update.member_token] ?? [];
            return {
              ...prev,
              [update.member_token]: [
                ...existing.slice(-19),
                {
                  score: update.risk_score,
                  tier:  update.risk_tier,
                  time:  new Date(update.processed_at).toLocaleTimeString(),
                },
              ],
            };
          });
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
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  const scoreList = Object.values(scores).sort((a, b) => b.risk_score - a.risk_score);

  function clearHistory() {
    setScores({});
    setHistory({});
    setEvents([]);
    setTotalCount(0);
    setTierTotals({ low: 0, moderate: 0, high: 0, crisis: 0 });
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  return (
    <DashboardLayout
      title="Live Risk Dashboard"
      topbarRight={
        <div className="flex items-center gap-3">
          <button
            onClick={clearHistory}
            className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-dim transition-colors hover:text-ink"
          >
            Clear History
          </button>
          <div
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ background: connected ? "rgba(78,140,88,.15)" : "rgba(192,57,43,.15)" }}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: connected ? "#7AB882" : "#C0392B" }}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: connected ? "#4E8C58" : "#C0392B" }}
            >
              {connected ? "SSE Connected" : "Disconnected"}
            </span>
          </div>
          {lastPing && (
            <span className="font-mono text-[11px] text-dim">Last: {lastPing}</span>
          )}
        </div>
      }
    >
      {/* ── Stats row ── */}
      <div className="mb-5 grid grid-cols-5 gap-4">
        {[
          { label: "Total Analysed", value: totalCount,          color: "#4E8C58", bg: "#D4EDD7" },
          { label: "Crisis",         value: tierTotals.crisis,   color: "#C0392B", bg: "#FAE0DC" },
          { label: "High Risk",      value: tierTotals.high,     color: "#B35A38", bg: "#F5DDD4" },
          { label: "Moderate",       value: tierTotals.moderate, color: "#B8832A", bg: "#F5E6C8" },
          { label: "Low Risk",       value: tierTotals.low,      color: "#4E8C58", bg: "#D4EDD7" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-card border border-line bg-card p-5"
          >
            <div
              className="absolute left-0 right-0 top-0 h-0.5 rounded-t-card"
              style={{ background: stat.color }}
            />
            <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-dim">
              {stat.label}
            </div>
            <div className="font-serif text-4xl font-bold leading-none" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">

        {/* ── Member score cards ── */}
        <div>
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Member Risk Scores</h2>

          {scoreList.length === 0 ? (
            <div className="rounded-card border border-line bg-card p-10 text-center">
              <div className="mb-3 text-4xl">📡</div>
              <div className="mb-2 font-serif text-lg text-ink">Waiting for inference results</div>
              <p className="text-sm leading-relaxed text-dim">
                Go to <strong>Messages</strong>, select Amara, and send a message.
                <br />Scores will appear here in real-time via SSE.
              </p>
            </div>
          ) : (
            scoreList.map((s) => {
              const hist     = history[s.member_token] ?? [];
              const maxScore = Math.max(...hist.map((h) => h.score), 0.01);
              return (
                <div
                  key={s.member_token}
                  className="mb-4 rounded-card border bg-card p-5"
                  style={{ borderColor: `${TIER_COLORS[s.risk_tier]}40` }}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="text-base font-bold text-ink">{s.client_name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-dim">
                        {s.member_token.slice(0, 22)}…
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-extrabold leading-none" style={{ color: TIER_COLORS[s.risk_tier] }}>
                        {(s.risk_score * 100).toFixed(0)}%
                      </div>
                      <span
                        className="mt-1 inline-block rounded-md px-2.5 py-0.5 text-[11px] font-bold"
                        style={{ background: TIER_BG[s.risk_tier], color: TIER_COLORS[s.risk_tier] }}
                      >
                        {TIER_EMOJI[s.risk_tier]} {s.risk_tier.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Sparkline */}
                  {hist.length > 1 && (
                    <div className="mb-3 flex h-10 items-end gap-0.5">
                      {hist.map((h, i) => (
                        <div
                          key={i}
                          title={`${(h.score * 100).toFixed(0)}% at ${h.time}`}
                          className="flex-1 rounded-t-sm transition-all duration-300"
                          style={{
                            height:     `${(h.score / maxScore) * 100}%`,
                            minHeight:  3,
                            background: TIER_COLORS[h.tier] ?? "#4E8C58",
                            opacity:    i === hist.length - 1 ? 1 : 0.45,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <div className="mb-2 flex flex-wrap gap-3 text-xs text-ink">
                    <span><strong>Trend:</strong> {s.risk_trend}</span>
                    <span><strong>Action:</strong> {s.recommended_action?.replace(/_/g, " ")}</span>
                  </div>

                  {s.active_signals?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {s.active_signals.slice(0, 5).map((sig, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-canvas px-2 py-0.5 text-[10.5px] font-semibold text-ink"
                        >
                          {sig.signal_code} {(sig.confidence * 100).toFixed(0)}%
                        </span>
                      ))}
                      {s.active_signals.length > 5 && (
                        <span className="text-[10.5px] text-dim">+{s.active_signals.length - 5} more</span>
                      )}
                    </div>
                  )}

                  <div className="mt-2 font-mono text-[10px] text-dim">
                    Updated {new Date(s.processed_at).toLocaleTimeString()}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Activity log ── */}
        <div>
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Live Activity Log</h2>
          <div className="overflow-hidden rounded-card border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-xs font-bold text-dim">{events.length} events</span>
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: connected ? "#2E7D4F" : "#9C9188" }}
                />
                <span className="text-[11px] text-dim">{connected ? "Live" : "Offline"}</span>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {events.length === 0 ? (
                <div className="p-8 text-center text-sm text-dim">
                  No events yet. Go to Messages and send a message to Amara.
                </div>
              ) : (
                events.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b border-line px-4 py-2.5"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-sm"
                      style={{ background: TIER_BG[ev.tier] ?? "#F0EBE1" }}
                    >
                      {TIER_EMOJI[ev.tier] ?? "📊"}
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] text-ink">{ev.text}</div>
                      <div className="font-mono text-[10px] text-dim">{ev.time}</div>
                    </div>
                    <span
                      className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: TIER_BG[ev.tier], color: TIER_COLORS[ev.tier] }}
                    >
                      {ev.tier}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pipeline explanation */}
          <div className="mt-4 rounded-card bg-sidebar p-5">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-sage">
              How it works
            </div>
            {[
              "Coach sends a message in Messages page",
              "POST /api/chat enqueues job into BullMQ",
              "worker.mjs dequeues → calls Python FastAPI /v1/ingest/chat",
              "FastAPI calls OpenRouter LLM → returns risk tier + signals",
              "Result saved to PostgreSQL (background task)",
              "Worker publishes to Redis → SSE → this dashboard updates",
            ].map((step, i) => (
              <div key={i} className="mb-2 flex gap-2.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage text-[10px] font-bold text-white">
                  {i + 1}
                </div>
                <div className="text-xs leading-relaxed text-[rgba(253,250,245,0.65)]">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
