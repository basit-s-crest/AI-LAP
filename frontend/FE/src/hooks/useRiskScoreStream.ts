"use client";

import { useEffect, useState, useCallback } from "react";
import type { ScoreUpdateEvent } from "@/lib/vasl/types";
import {
  applyScoreUpdate,
  initCrossTabSync,
  loadRiskDashboardState,
  subscribeRiskDashboard,
  type RiskDashboardState,
} from "@/lib/riskEventStore";

/**
 * Shared SSE + persisted risk state for Messages and Risk Dashboard.
 * @param partnerId When set, per-message risk cache is updated for this thread.
 */
export function useRiskScoreStream(partnerId?: string | null) {
  const [dashboard, setDashboard] = useState<RiskDashboardState>(() =>
    typeof window === "undefined"
      ? {
          scores: {},
          history: {},
          events: [],
          totalCount: 0,
          tierTotals: { low: 0, moderate: 0, high: 0, crisis: 0 },
        }
      : loadRiskDashboardState()
  );
  const [connected, setConnected] = useState(false);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<ScoreUpdateEvent | null>(null);

  useEffect(() => {
    setDashboard(loadRiskDashboardState());
    return subscribeRiskDashboard(setDashboard);
  }, []);

  useEffect(() => initCrossTabSync(), []);

  const onScoreUpdate = useCallback(
    (update: ScoreUpdateEvent) => {
      applyScoreUpdate(update, partnerId ?? update.member_token);
      setLatestUpdate(update);
      setLastPing(new Date().toLocaleTimeString());
    },
    [partnerId]
  );

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
          onScoreUpdate(data.payload as ScoreUpdateEvent);
        }
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [onScoreUpdate]);

  return {
    dashboard,
    connected,
    lastPing,
    latestUpdate,
    scoreForMember: (memberToken: string) => dashboard.scores[memberToken] ?? null,
  };
}
