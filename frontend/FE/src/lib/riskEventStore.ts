import type { ScoreUpdateEvent } from "@/lib/vasl/types";
import { mergeRiskCache, type MessageRiskMeta } from "@/lib/msgRiskCache";

export interface HistoryEntry {
  score: number;
  tier: string;
  time: string;
}

export interface RiskDashboardState {
  scores: Record<string, ScoreUpdateEvent>;
  history: Record<string, HistoryEntry[]>;
  events: Array<{ text: string; time: string; tier: string }>;
  totalCount: number;
  tierTotals: { low: number; moderate: number; high: number; crisis: number };
}

const STORAGE_KEY = "vasl_risk_dashboard_v1";

const EMPTY: RiskDashboardState = {
  scores: {},
  history: {},
  events: [],
  totalCount: 0,
  tierTotals: { low: 0, moderate: 0, high: 0, crisis: 0 },
};

type Listener = (state: RiskDashboardState) => void;

const listeners = new Set<Listener>();

function notify(state: RiskDashboardState): void {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function loadRiskDashboardState(): RiskDashboardState {
  if (typeof window === "undefined") return { ...EMPTY, scores: {}, history: {}, events: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RiskDashboardState;
      return {
        scores: parsed.scores ?? {},
        history: parsed.history ?? {},
        events: parsed.events ?? [],
        totalCount: parsed.totalCount ?? 0,
        tierTotals: parsed.tierTotals ?? { ...EMPTY.tierTotals },
      };
    }
  } catch {
    /* ignore */
  }
  return {
    scores: {},
    history: {},
    events: [],
    totalCount: 0,
    tierTotals: { ...EMPTY.tierTotals },
  };
}

export function saveRiskDashboardState(state: RiskDashboardState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function subscribeRiskDashboard(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function tierKey(tier: string): keyof RiskDashboardState["tierTotals"] {
  if (tier === "low" || tier === "moderate" || tier === "high" || tier === "crisis") {
    return tier;
  }
  return "low";
}

/** Apply one SSE score update to dashboard state + per-message cache. */
export function applyScoreUpdate(
  update: ScoreUpdateEvent,
  partnerIdForMessages?: string | null
): RiskDashboardState {
  const prev = loadRiskDashboardState();
  const tier = tierKey(update.risk_tier);

  const scores = { ...prev.scores, [update.member_token]: update };
  const existingHist = prev.history[update.member_token] ?? [];
  const history = {
    ...prev.history,
    [update.member_token]: [
      ...existingHist.slice(-19),
      {
        score: update.risk_score,
        tier: update.risk_tier,
        time: new Date(update.processed_at).toLocaleTimeString(),
      },
    ],
  };
  const events = [
    {
      text: `${update.client_name} — ${update.risk_tier.toUpperCase()} (${(update.risk_score * 100).toFixed(0)}%)`,
      time: new Date().toLocaleTimeString(),
      tier: update.risk_tier,
    },
    ...prev.events.slice(0, 49),
  ];
  const totalCount = prev.totalCount + 1;
  const tierTotals = {
    ...prev.tierTotals,
    [tier]: (prev.tierTotals[tier] ?? 0) + 1,
  };

  const next: RiskDashboardState = {
    scores,
    history,
    events,
    totalCount,
    tierTotals,
  };

  saveRiskDashboardState(next);
  notify(next);

  const messageId = update.original_source_id;
  const memberId = partnerIdForMessages ?? update.member_token;
  if (messageId && memberId) {
    const meta: MessageRiskMeta = {
      risk_tier: update.risk_tier,
      risk_score: update.risk_score,
      signal_codes:
        update.signal_codes ??
        update.active_signals?.map((s) => s.signal_code).filter(Boolean) ??
        [],
    };
    mergeRiskCache(memberId, { [messageId]: meta });
  }

  return next;
}

export function clearRiskDashboard(): RiskDashboardState {
  const next = {
    scores: {},
    history: {},
    events: [],
    totalCount: 0,
    tierTotals: { low: 0, moderate: 0, high: 0, crisis: 0 },
  };
  saveRiskDashboardState(next);
  notify(next);
  return next;
}

/** Sync state when another tab writes localStorage. */
export function initCrossTabSync(): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    notify(loadRiskDashboardState());
  };

  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
