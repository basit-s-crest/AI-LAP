import React, { useState } from "react";
import { cn } from "@/lib/cn";

export interface ChangeInsightDTO {
  id: string;
  memberId: string;
  sessionNoteIdA?: string | null;
  sessionNoteIdB: string;
  summary: string;
  improvements: any; // Array of { area: string, details: string }
  concerns: any;     // Array of { area: string, details: string }
  goals: any;        // Array of { goal: string, progress: string }
  behavioralPatterns: any; // Array of strings
  safetyFlags: any;  // Array of { flag: string, reason: string }
  hasSafetyAlert: boolean;
  createdAt: string;
}

interface ChangeInsightsPanelProps {
  insight?: ChangeInsightDTO | null;
  isLoading?: boolean;
  statusMessage?: string | null; // e.g. "No previous note found for comparison."
}

export default function ChangeInsightsPanel({
  insight,
  isLoading,
  statusMessage,
}: ChangeInsightsPanelProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "improvements" | "concerns" | "goals" | "patterns">("summary");

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-4 p-5 animate-pulse bg-white rounded-2xl border border-[#D2DBE3] h-full justify-center">
        <div className="h-6 w-1/3 bg-[#F1F6FC] rounded-lg self-center" />
        <div className="h-4 w-full bg-[#F1F6FC] rounded-lg" />
        <div className="h-4 w-5/6 bg-[#F1F6FC] rounded-lg" />
        <div className="h-4 w-4/6 bg-[#F1F6FC] rounded-lg" />
        <div className="flex gap-2 pt-2">
          <div className="h-8 w-20 bg-[#F1F6FC] rounded-full" />
          <div className="h-8 w-24 bg-[#F1F6FC] rounded-full" />
        </div>
      </div>
    );
  }

  if (statusMessage) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-[#D2DBE3] text-[#5C6B73]">
        <span className="text-3xl mb-2">ℹ️</span>
        <h4 className="font-outfit font-bold text-[#1E252B] text-base">Comparison Status</h4>
        <p className="text-sm font-sans text-dim mt-1 max-w-[280px]">
          {statusMessage}
        </p>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-[#D2DBE3] text-[#5C6B73]">
        <span className="text-3xl mb-2">🧠</span>
        <h4 className="font-outfit font-bold text-[#1E252B] text-base">AI Change Insights</h4>
        <p className="text-sm font-sans text-dim mt-1 max-w-[280px]">
          Save the current session note to trigger session-to-session progress comparison.
        </p>
      </div>
    );
  }

  // Parse arrays safely
  const improvements = Array.isArray(insight.improvements) ? insight.improvements : [];
  const concerns = Array.isArray(insight.concerns) ? insight.concerns : [];
  const goals = Array.isArray(insight.goals) ? insight.goals : [];
  const patterns = Array.isArray(insight.behavioralPatterns) ? insight.behavioralPatterns : [];
  const safetyFlags = Array.isArray(insight.safetyFlags) ? insight.safetyFlags : [];

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-[#D2DBE3] overflow-hidden">
      {/* Safety Alert Header */}
      {insight.hasSafetyAlert && (
        <div className="flex items-start gap-3 bg-[#FFEBEE] border-b border-[#FFCDD2] p-4 text-[#C62828] shrink-0">
          <span className="text-xl">⚠️</span>
          <div>
            <h5 className="font-outfit font-bold text-sm">Worsening Trend or Safety Concern Detected</h5>
            {safetyFlags.length > 0 ? (
              <ul className="list-disc list-inside text-xs mt-1 space-y-0.5 opacity-90">
                {safetyFlags.map((flag: any, i: number) => (
                  <li key={i}>
                    <strong>{flag.flag || "Flag"}:</strong> {flag.reason || "Reason not provided"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs mt-0.5 opacity-90">
                AI flagged potential crisis language or a worsening trajectory. Review note details carefully.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-line bg-[var(--bg-surface-2)] p-2 gap-1 overflow-x-auto shrink-0">
        {[
          { key: "summary", label: "Summary" },
          { key: "improvements", label: `Improvements (${improvements.length})` },
          { key: "concerns", label: `Concerns (${concerns.length})` },
          { key: "goals", label: `Goals (${goals.length})` },
          { key: "patterns", label: `Patterns (${patterns.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold font-outfit whitespace-nowrap transition-all",
              activeTab === tab.key
                ? "bg-white text-[#4E8C58] shadow-sm font-bold border border-[#D2DBE3]"
                : "text-[#5C6B73] hover:text-[#1E252B]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 p-4 overflow-y-auto min-h-0 text-sm font-sans text-[#1E252B] leading-relaxed">
        {activeTab === "summary" && (
          <div className="space-y-3">
            <h4 className="font-outfit font-bold text-[#1E252B] text-base mb-1">Session-to-Session Progress Summary</h4>
            <div className="p-4 bg-[#F1F6FC] border border-[#D2DBE3] rounded-xl text-ink font-sans text-sm leading-relaxed shadow-sm">
              {insight.summary}
            </div>
            {safetyFlags.length > 0 && !insight.hasSafetyAlert && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                <strong>Subtle Flags:</strong> Review potential risk items in the safety indicators tab.
              </div>
            )}
          </div>
        )}

        {activeTab === "improvements" && (
          <div className="space-y-3">
            <h4 className="font-outfit font-bold text-base text-sage mb-2">Areas of Improvement</h4>
            {improvements.length === 0 ? (
              <p className="text-dim text-xs italic">No specific improvements identified in this run.</p>
            ) : (
              <div className="space-y-3">
                {improvements.map((item: any, i: number) => (
                  <div key={i} className="p-3 border border-line rounded-xl bg-[var(--bg-surface-2)]">
                    <div className="font-bold text-xs text-sage uppercase tracking-wider">{item.area}</div>
                    <div className="text-sm mt-1 text-ink">{item.details}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "concerns" && (
          <div className="space-y-3">
            <h4 className="font-outfit font-bold text-base text-[#D32F2F] mb-2">Identified Concerns & Risk Markers</h4>
            {concerns.length === 0 ? (
              <p className="text-dim text-xs italic">No new concerns or worsening trends identified.</p>
            ) : (
              <div className="space-y-3">
                {concerns.map((item: any, i: number) => (
                  <div key={i} className="p-3 border border-red-100 rounded-xl bg-red-50/30">
                    <div className="font-bold text-xs text-[#D32F2F] uppercase tracking-wider">{item.area}</div>
                    <div className="text-sm mt-1 text-ink">{item.details}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "goals" && (
          <div className="space-y-3">
            <h4 className="font-outfit font-bold text-base text-gold mb-2">Goal Tracking & recommendedFollowUp Progress</h4>
            {goals.length === 0 ? (
              <p className="text-dim text-xs italic">No specific follow-up goals tracked in this comparison.</p>
            ) : (
              <div className="space-y-3">
                {goals.map((item: any, i: number) => (
                  <div key={i} className="p-3 border border-line rounded-xl bg-[var(--bg-surface-2)]">
                    <div className="font-bold text-sm text-[#1E252B]">{item.goal}</div>
                    <div className="text-xs text-dim mt-1">
                      <strong>Status/Progress:</strong> {item.progress}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "patterns" && (
          <div className="space-y-3">
            <h4 className="font-outfit font-bold text-base text-[#311B92] mb-2">Behavioral & Cognitive Patterns</h4>
            {patterns.length === 0 ? (
              <p className="text-dim text-xs italic">No recurring cognitive or behavioral patterns extracted.</p>
            ) : (
              <ul className="space-y-2">
                {patterns.map((pattern: string, i: number) => (
                  <li key={i} className="flex gap-2.5 items-start p-2.5 border border-line rounded-lg bg-[var(--bg-surface-2)] text-ink text-sm">
                    <span className="text-base select-none">🧩</span>
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
