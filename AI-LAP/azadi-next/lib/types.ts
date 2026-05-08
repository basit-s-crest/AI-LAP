// ── Shared types across the app ────────────────────────────────────────────

export interface Client {
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

export interface ChatMessage {
  id: string;
  role: "coach" | "user";
  name: string;
  text: string;
  time: string;
  pending?: boolean;
}

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

export interface InferenceResult {
  event_id: string;
  member_token: string;
  risk_tier: "low" | "moderate" | "high" | "crisis";
  risk_score: number;
  risk_trend: "stable" | "increasing" | "decreasing";
  recommended_action: string;
  cultural_context: string[];
  active_signals: Signal[];
  shap_attributions: ShapAttribution[];
  processed_at: string;
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
}

// SSE event pushed to the dashboard
export interface ScoreUpdateEvent {
  member_token: string;
  client_name: string;
  risk_tier: "low" | "moderate" | "high" | "crisis";
  risk_score: number;
  risk_trend: "stable" | "increasing" | "decreasing";
  recommended_action: string;
  active_signals: Signal[];
  processed_at: string;
}
