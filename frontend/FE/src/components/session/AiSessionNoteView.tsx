import React, { useState } from "react";
import type { AiSessionNoteDTO } from "@/types/sessionNote";
import { cn } from "@/lib/cn";

interface AiSessionNoteViewProps {
  note?: AiSessionNoteDTO | null;
  isLoading?: boolean;
}

export default function AiSessionNoteView({ note, isLoading }: AiSessionNoteViewProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "sentiment" | "themes" | "safety">("summary");

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-4 p-5 animate-pulse bg-white rounded-2xl border border-[#D2DBE3]">
        <div className="h-6 w-1/3 bg-[#F1F6FC] rounded-lg" />
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

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-[#D2DBE3] text-[#5C6B73]">
        <span className="text-3xl mb-2">💡</span>
        <h4 className="font-outfit font-bold text-[#1E252B] text-base">AI Analysis Ready</h4>
        <p className="text-sm font-sans text-dim mt-1 max-w-[280px]">
          End the session call to trigger real-time AI transcription analysis.
        </p>
      </div>
    );
  }

  const sentimentStyles: Record<string, { bg: string; text: string; emoji: string }> = {
    Anxious: { bg: "bg-[#FFF3E0]", text: "text-[#E65100]", emoji: "😰" },
    Depressed: { bg: "bg-[#ECEFF1]", text: "text-[#37474F]", emoji: "😢" },
    Neutral: { bg: "bg-[#F1F6FC]", text: "text-[#5C6B73]", emoji: "😐" },
    Reflective: { bg: "bg-[#E8F5E9]", text: "text-[#2E7D32]", emoji: "💭" },
    Agitated: { bg: "bg-[#FFEBEE]", text: "text-[#C62828]", emoji: "😠" },
  };

  const getSentimentStyle = (sentimentText: string) => {
    // Attempt partial match
    for (const key of Object.keys(sentimentStyles)) {
      if (sentimentText.toLowerCase().includes(key.toLowerCase())) {
        return sentimentStyles[key];
      }
    }
    return { bg: "bg-[#E0F7FA]", text: "text-[#006064]", emoji: "🧠" }; // Default cool cyan
  };

  const sentimentStyle = getSentimentStyle(note.memberSentiment);

  return (
    <div className="flex flex-col w-full bg-white rounded-2xl border border-[#D2DBE3] overflow-hidden shadow-sm">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#68A688] to-[#4E8C58] p-4 text-white flex justify-between items-center">
        <div>
          <h4 className="font-outfit font-bold text-md tracking-wide">AI SESSION NOTES</h4>
          <p className="text-[11px] opacity-90 font-sans mt-0.5">
            Claude-Powered Clinical Insights
          </p>
        </div>
        {note.riskFlag ? (
          <span className="bg-[#FFEBEE] text-[#C62828] font-outfit text-xs font-bold px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1 shadow-sm">
            ⚠️ SAFETY ALERT
          </span>
        ) : (
          <span className="bg-white/20 font-outfit text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
            ✓ Normal Range
          </span>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-[#D2DBE3] bg-[#F8FAFC]">
        {(["summary", "sentiment", "themes", "safety"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 px-2 text-xs font-semibold font-outfit border-b-2 capitalize transition-all",
              activeTab === tab
                ? "border-[#4E8C58] text-[#4E8C58] bg-white font-bold"
                : "border-transparent text-[#5C6B73] hover:text-[#1E252B] hover:bg-[#F1F6FC]/50"
            )}
          >
            {tab === "themes" ? "Themes & Action" : tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="p-5 min-h-[190px]">
        {activeTab === "summary" && (
          <div className="space-y-2 animate-fadeIn">
            <h5 className="font-outfit font-bold text-[#1E252B] text-sm">Clinical Summary</h5>
            <p className="text-sm font-sans text-[#5C6B73] leading-relaxed">
              {note.summary}
            </p>
          </div>
        )}

        {activeTab === "sentiment" && (
          <div className="space-y-4 animate-fadeIn">
            <div>
              <h5 className="font-outfit font-bold text-[#1E252B] text-sm mb-2">Member Sentiment</h5>
              <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm", sentimentStyle.bg, sentimentStyle.text)}>
                <span>{sentimentStyle.emoji}</span>
                <span>{note.memberSentiment}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-[#F1F6FC]">
              <h5 className="font-outfit font-bold text-[#1E252B] text-sm mb-1">Engagement & Observations</h5>
              <p className="text-sm font-sans text-[#5C6B73] leading-relaxed">
                {note.coachObservations}
              </p>
            </div>
          </div>
        )}

        {activeTab === "themes" && (
          <div className="space-y-4 animate-fadeIn">
            <div>
              <h5 className="font-outfit font-bold text-[#1E252B] text-sm mb-2">Extracted Key Themes</h5>
              <div className="flex flex-wrap gap-1.5">
                {note.keyThemes.map((theme, idx) => (
                  <span
                    key={idx}
                    className="bg-[#F1F6FC] text-[#1E252B] border border-[#D2DBE3] font-outfit text-xs font-medium px-2.5 py-1 rounded-full shadow-sm"
                  >
                    #{theme}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-[#F1F6FC]">
              <h5 className="font-outfit font-bold text-[#1E252B] text-sm mb-1">Recommended Follow-up Goals</h5>
              <p className="text-sm font-sans text-[#5C6B73] leading-relaxed">
                {note.recommendedFollowUp}
              </p>
            </div>
          </div>
        )}

        {activeTab === "safety" && (
          <div className="space-y-3 animate-fadeIn">
            <h5 className="font-outfit font-bold text-[#1E252B] text-sm">Safety Risk Assessment</h5>
            {note.riskFlag ? (
              <div className="bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl p-4 text-[#C62828]">
                <div className="flex items-center gap-2 font-outfit font-bold text-sm">
                  <span>⚠️</span>
                  <span>Safety Flag Active</span>
                </div>
                <p className="text-xs font-sans mt-2 leading-relaxed text-[#B71C1C]">
                  {note.riskNotes || "Safety risks have been noted in client communications."}
                </p>
              </div>
            ) : (
              <div className="bg-[#E8F5E9] border border-[#C8E6C9] rounded-xl p-4 text-[#2E7D32]">
                <div className="flex items-center gap-2 font-outfit font-bold text-sm">
                  <span>✓</span>
                  <span>Safety Assured</span>
                </div>
                <p className="text-xs font-sans mt-2 leading-relaxed text-[#1B5E20]">
                  No active suicidal, self-harm, or security risk phrases were matched or identified in the session conversation.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
