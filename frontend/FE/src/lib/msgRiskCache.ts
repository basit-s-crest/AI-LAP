export type RiskTier = "low" | "moderate" | "high" | "crisis";

export interface MessageRiskMeta {
  risk_tier: RiskTier;
  risk_score: number;
  signal_codes: string[];
}

const MAX_ENTRIES = 200;

export function cacheKey(partnerId: string): string {
  return `vasl_msg_risk_${partnerId}`;
}

export function loadRiskCache(partnerId: string): Record<string, MessageRiskMeta> {
  if (typeof window === "undefined" || !partnerId) return {};
  try {
    const raw = localStorage.getItem(cacheKey(partnerId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MessageRiskMeta>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRiskCache(
  partnerId: string,
  data: Record<string, MessageRiskMeta>
): void {
  if (typeof window === "undefined" || !partnerId) return;
  try {
    const keys = Object.keys(data);
    let trimmed = data;
    if (keys.length > MAX_ENTRIES) {
      const keep = keys.slice(-MAX_ENTRIES);
      trimmed = {};
      for (const k of keep) {
        trimmed[k] = data[k];
      }
    }
    localStorage.setItem(cacheKey(partnerId), JSON.stringify(trimmed));
  } catch {
    /* quota or private mode */
  }
}

export function mergeRiskCache(
  partnerId: string,
  incoming: Record<string, MessageRiskMeta>
): Record<string, MessageRiskMeta> {
  const existing = loadRiskCache(partnerId);
  const merged = { ...existing, ...incoming };
  saveRiskCache(partnerId, merged);
  return merged;
}

export function riskFromMessageDto(msg: {
  id: string;
  risk_tier?: RiskTier | null;
  risk_score?: number | null;
  signal_codes?: string[] | null;
}): MessageRiskMeta | null {
  if (!msg.risk_tier || msg.risk_score == null) return null;
  return {
    risk_tier: msg.risk_tier,
    risk_score: msg.risk_score,
    signal_codes: msg.signal_codes ?? [],
  };
}
