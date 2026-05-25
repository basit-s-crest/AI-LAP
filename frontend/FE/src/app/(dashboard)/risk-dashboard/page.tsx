"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import type { ScoreUpdateEvent } from "@/lib/vasl/types";
import { AUTH_ROLE_KEY } from "@/constants/storage";

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

// ── Empty defaults ──────────────────────────────────────────────────────────
const EMPTY_STATE: PersistedState = {
  scores:     {},
  history:    {},
  events:     [],
  totalCount: 0,
  tierTotals: { low: 0, moderate: 0, high: 0, crisis: 0 },
};

// ── Icons ──────────────────────────────────────────────────────────────────
const ChevronDownIcon = () => (
  <svg className="h-3.5 w-3.5 text-dim shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const SearchIcon = () => (
  <svg className="h-3.5 w-3.5 text-dim shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

// ── Helper ──────────────────────────────────────────────────────────────────
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const encoded = encodeURIComponent(name);
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${encoded}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function RiskDashboardPage() {
  const [rawUpdates, setRawUpdates] = useState<ScoreUpdateEvent[]>([]);
  const [assignedMembers, setAssignedMembers] = useState<any[]>([]);
  const [assignedMemberTokens, setAssignedMemberTokens] = useState<Set<string>>(new Set());
  const [connected, setConnected]   = useState(false);
  const [lastPing, setLastPing]     = useState<string | null>(null);

  // Filter States
  const [selectedPeriod, setSelectedPeriod] = useState<"all" | "7d" | "30d" | "60d" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isFilterEnabled, setIsFilterEnabled] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Hydrate historical data and coach members from backend
  useEffect(() => {
    const { default: api } = require("@/lib/api");
    const userRole = getCookie(AUTH_ROLE_KEY);
    setRole(userRole);

    if (userRole === "coach") {
      api.get("/api/coach/members")
        .then(({ data }: { data: { members: any[] } }) => {
          setAssignedMembers(data.members);
          setAssignedMemberTokens(new Set(data.members.map((m) => m.id)));
        })
        .catch((err: any) => {
          console.error("Failed to load coach members:", err);
        });
    }

    api.get("/api/coach/scores/history")
      .then(({ data }: { data: ScoreUpdateEvent[] }) => {
        setRawUpdates(data);
      })
      .catch((err: any) => {
        console.error("Failed to load historical risk data:", err);
      });
  }, []);

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
          setRawUpdates((prev) => [...prev, update]);
          setLastPing(new Date().toLocaleTimeString());
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  // Extract unique patients list for filter
  const allPatients = useMemo(() => {
    if (role === "coach") {
      return assignedMembers.map((m) => {
        const updates = rawUpdates.filter((u) => u.member_token === m.id);
        const latestTier = updates.length > 0 ? updates[updates.length - 1].risk_tier : "low";
        return {
          token: m.id,
          name: m.name || "Member",
          latestTier,
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const map = new Map<string, { token: string; name: string; latestTier: string }>();
      rawUpdates.forEach((u) => {
        if (!map.has(u.member_token)) {
          map.set(u.member_token, {
            token: u.member_token,
            name: u.client_name,
            latestTier: u.risk_tier,
          });
        } else {
          const existing = map.get(u.member_token)!;
          existing.latestTier = u.risk_tier;
        }
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [role, assignedMembers, rawUpdates]);

  const filteredPatientsForDropdown = useMemo(() => {
    return allPatients.filter((p) =>
      p.name.toLowerCase().includes(patientSearchQuery.toLowerCase())
    );
  }, [allPatients, patientSearchQuery]);

  // Derived filter updates
  const filteredUpdates = useMemo(() => {
    return rawUpdates.filter((u) => {
      // 1. Coach restriction: only show assigned members' updates
      if (role === "coach" && !assignedMemberTokens.has(u.member_token)) {
        return false;
      }

      // 2. Patient selection filter
      if (isFilterEnabled) {
        if (!selectedPatients.includes(u.member_token)) {
          return false;
        }
      }

      // 3. Time range filter
      const date = new Date(u.processed_at);
      if (selectedPeriod === "7d") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        if (date < cutoff) return false;
      } else if (selectedPeriod === "30d") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        if (date < cutoff) return false;
      } else if (selectedPeriod === "60d") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 60);
        if (date < cutoff) return false;
      } else if (selectedPeriod === "custom") {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          if (date < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (date > end) return false;
        }
      }
      return true;
    });
  }, [rawUpdates, role, assignedMemberTokens, isFilterEnabled, selectedPatients, selectedPeriod, customStartDate, customEndDate]);

  // Derive metrics
  const totalCount = filteredUpdates.length;

  const tierTotals = useMemo(() => {
    const totals = { low: 0, moderate: 0, high: 0, crisis: 0 };
    filteredUpdates.forEach((u) => {
      if (u.risk_tier in totals) {
        totals[u.risk_tier]++;
      }
    });
    return totals;
  }, [filteredUpdates]);

  const scoreList = useMemo(() => {
    const latestMap: Record<string, ScoreUpdateEvent> = {};
    filteredUpdates.forEach((u) => {
      latestMap[u.member_token] = u;
    });
    return Object.values(latestMap).sort((a, b) => b.risk_score - a.risk_score);
  }, [filteredUpdates]);

  const history = useMemo(() => {
    const histMap: Record<string, HistoryEntry[]> = {};
    filteredUpdates.forEach((u) => {
      if (!histMap[u.member_token]) {
        histMap[u.member_token] = [];
      }
      histMap[u.member_token].push({
        score: u.risk_score,
        tier:  u.risk_tier,
        time:  new Date(u.processed_at).toLocaleTimeString(),
      });
    });
    Object.keys(histMap).forEach((k) => {
      histMap[k] = histMap[k].slice(-20);
    });
    return histMap;
  }, [filteredUpdates]);

  const events = useMemo(() => {
    return filteredUpdates.map((u) => ({
      text: `${u.client_name} — ${u.risk_tier.toUpperCase()} (${(u.risk_score * 100).toFixed(0)}%)`,
      time: new Date(u.processed_at).toLocaleTimeString(),
      tier: u.risk_tier,
    })).reverse();
  }, [filteredUpdates]);

  // Dropdown Label
  const dropdownLabel = useMemo(() => {
    if (!isFilterEnabled) return "All Patients";
    if (selectedPatients.length === 0) return "No Patients Selected";
    if (selectedPatients.length === 1) {
      const match = allPatients.find((p) => p.token === selectedPatients[0]);
      return match ? match.name : "1 Patient Selected";
    }
    return `${selectedPatients.length} Patients Selected`;
  }, [isFilterEnabled, selectedPatients, allPatients]);

  const handleTogglePatient = (token: string) => {
    if (!isFilterEnabled) {
      const otherTokens = allPatients
        .map((p) => p.token)
        .filter((t) => t !== token);
      setIsFilterEnabled(true);
      setSelectedPatients(otherTokens);
    } else {
      setSelectedPatients((prev) => {
        const next = prev.includes(token)
          ? prev.filter((t) => t !== token)
          : [...prev, token];

        if (next.length === allPatients.length) {
          setIsFilterEnabled(false);
          return [];
        }
        return next;
      });
    }
  };

  const handleToggleAllPatients = () => {
    setIsFilterEnabled(false);
    setSelectedPatients([]);
  };

  function clearHistory() {
    setRawUpdates([]);
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
      {/* ── Filter Controls Row ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-card p-4 shadow-soft">
        {/* Left side: Patient selector dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-dim">Filter:</span>
          {/* Patient Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-between gap-2.5 rounded-lg border border-line bg-canvas px-4 py-2 text-xs font-bold text-ink transition-all hover:bg-card hover:shadow-sm"
              type="button"
            >
              <span>{dropdownLabel}</span>
              <ChevronDownIcon />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 mt-2 z-30 w-72 rounded-card border border-line bg-card p-3 shadow-soft animate-fadeIn">
                {/* Search box */}
                <div className="relative mb-2.5">
                  <span className="absolute left-2.5 top-2">
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    placeholder="Search patients..."
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-line bg-canvas pl-8 pr-3 py-1.5 text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-sage animate-fadeIn"
                  />
                </div>

                {/* Patient List */}
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                  {/* All Patients Option */}
                  <label
                    onClick={handleToggleAllPatients}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-bold text-ink transition-colors hover:bg-canvas cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!isFilterEnabled}
                      readOnly
                      className="h-3.5 w-3.5 rounded border-line text-sage focus:ring-sage cursor-pointer"
                    />
                    <span>All Patients</span>
                  </label>

                  <div className="h-px bg-line my-1" />

                  {filteredPatientsForDropdown.length === 0 ? (
                    <div className="py-4 text-center text-xs text-dim">No patients found</div>
                  ) : (
                    filteredPatientsForDropdown.map((p) => {
                      const isChecked = isFilterEnabled ? selectedPatients.includes(p.token) : true;
                      return (
                        <label
                          key={p.token}
                          onClick={() => handleTogglePatient(p.token)}
                          className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="h-3.5 w-3.5 rounded border-line text-sage focus:ring-sage cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className="font-semibold text-ink">{p.name}</span>
                              <span className="font-mono text-[9.5px] text-dim">{p.token.slice(0, 10)}…</span>
                            </div>
                          </div>
                          {/* Risk Badge Indicator */}
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: TIER_COLORS[p.latestTier] || "#4E8C58" }}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-wide text-dim">
                              {p.latestTier}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Day/Date selection */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-dim">Timeframe:</span>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-canvas p-1">
            {[
              { id: "all", label: "All Time" },
              { id: "7d", label: "7 Days" },
              { id: "30d", label: "30 Days" },
              { id: "60d", label: "60 Days" },
              { id: "custom", label: "Custom" },
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id as any)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                  selectedPeriod === period.id
                    ? "bg-card text-ink shadow-sm"
                    : "text-dim hover:text-ink"
                }`}
                type="button"
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {selectedPeriod === "custom" && (
            <div className="flex items-center gap-2 animate-fadeIn">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-sage"
              />
              <span className="text-xs text-dim">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-sage"
              />
            </div>
          )}
        </div>
      </div>

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