// ── VASL LLM inference shared types ───────────────────────────────────────

export interface Signal {
  signal_code: string;
  signal_label: string | null;
  confidence: number;
  dimension: string | null;
}

export interface ShapAttribution {
  span: string;
  weight: number;
  signal_code: string | null;
  rank: number | null;
}

// Payload pushed into BullMQ
export interface ChatJobPayload {
  event_id: string;
  org_id: string;
  member_token: string;
  session_id: string;
  role: "member" | "coach";
  text: string;
  timestamp: string;
  consent_active: boolean;
  client_name: string;
  enqueue_time?: number;
}

// SSE event pushed to the dashboard
export interface ScoreUpdateEvent {
  event_id?: string;
  original_source_id?: string;
  member_token: string;
  client_name: string;
  risk_tier: "low" | "moderate" | "high" | "crisis";
  risk_score: number;
  risk_trend: "stable" | "increasing" | "decreasing";
  recommended_action: string;
  active_signals: Signal[];
  signal_codes?: string[];
  processed_at: string;
}
