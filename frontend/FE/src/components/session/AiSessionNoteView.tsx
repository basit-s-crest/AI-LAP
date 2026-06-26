import React, { useState, useEffect } from "react";
import type { AiSessionNoteDTO } from "@/types/sessionNote";
import { cn } from "@/lib/cn";
import { sessionNoteService } from "@/services/sessionNote.service";
import { Button } from "@/components/ui/Button";

interface AiSessionNoteViewProps {
  note?: AiSessionNoteDTO | null;
  isLoading?: boolean;
  sessionId: string;
  onEditNote: () => void;
}

export default function AiSessionNoteView({
  note,
  isLoading,
  sessionId,
  onEditNote,
}: AiSessionNoteViewProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "sentiment" | "themes" | "safety">("summary");
  const [hasExistingNote, setHasExistingNote] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    sessionNoteService.getSessionNote(sessionId)
      .then((res) => {
        if (res.exists) {
          setHasExistingNote(true);
        }
      })
      .catch((err) => {
        console.error("[AiSessionNoteView] Failed to verify existing note status:", err);
      });
  }, [sessionId]);

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
    for (const key of Object.keys(sentimentStyles)) {
      if (sentimentText.toLowerCase().includes(key.toLowerCase())) {
        return sentimentStyles[key];
      }
    }
    return { bg: "bg-[#E0F7FA]", text: "text-[#006064]", emoji: "🧠" };
  };

  const sentimentStyle = getSentimentStyle(note.memberSentiment);

  const emotionCounts = note.emotionCounts || {};
  const totalCounts = Object.values(emotionCounts).reduce((a: number, b) => a + (b as number), 0);

  const getEmotionDetails = (emotion: string): { color: string; emoji: string } => {
    const map: Record<string, { color: string; emoji: string }> = {
      happy: { color: "#FFD54F", emoji: "😊" },
      sad: { color: "#64B5F6", emoji: "😢" },
      angry: { color: "#E57373", emoji: "😠" },
      fear: { color: "#9575CD", emoji: "😨" },
      neutral: { color: "#B0BEC5", emoji: "😐" },
      calm: { color: "#81C784", emoji: "😌" },
      anxious: { color: "#FFB74D", emoji: "😰" },
      surprise: { color: "#4DD0E1", emoji: "😲" },
      disgust: { color: "#A1887F", emoji: "🤢" },
      distracted: { color: "#F06292", emoji: "👀" },
      "unstable presence": { color: "#E57373", emoji: "⚠️" },
      "no face": { color: "#78909C", emoji: "👤" },
      "camera off": { color: "#78909C", emoji: "📷" },
      "intermittent presence": { color: "#FFB74D", emoji: "🔄" },
    };
    const key = emotion.toLowerCase();
    return map[key] || { color: "#CFD8DC", emoji: "🟡" };
  };

  const segments = Object.entries(emotionCounts)
    .map(([emotion, count]) => {
      const percentage = totalCounts > 0 ? ((count as number) / totalCounts) * 100 : 0;
      return { emotion, count: count as number, percentage };
    })
    .filter((s) => s.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);

  const timeline = Array.isArray(note.emotionTimeline) ? note.emotionTimeline : [];

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return ts;
    }
  };

  return (
    <div className="flex flex-col w-full bg-white rounded-2xl border border-[#D2DBE3] overflow-hidden shadow-sm h-full max-h-[700px]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#68A688] to-[#4E8C58] p-4 text-white flex justify-between items-center shrink-0">
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
      <div className="flex border-b border-[#D2DBE3] bg-[#F8FAFC] shrink-0">
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
      <div className="p-5 flex-1 overflow-y-auto min-h-[190px]">
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
            <div className="flex gap-6 items-start">
              <div>
                <h5 className="font-outfit font-bold text-[#1E252B] text-sm mb-2">Member Sentiment</h5>
                <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm", sentimentStyle.bg, sentimentStyle.text)}>
                  <span>{sentimentStyle.emoji}</span>
                  <span>{note.memberSentiment}</span>
                </div>
              </div>
            </div>

            {/* Session Emotion Distribution */}
            {segments.length > 0 && (
              <div className="pt-2 border-t border-[#F1F6FC]">
                <h5 className="font-outfit font-bold text-[#1E252B] text-sm mb-2">Session Emotion Distribution</h5>
                <div className="h-4 w-full rounded-full overflow-hidden flex bg-gray-100 mb-2">
                  {segments.map((seg, idx) => {
                    const details = getEmotionDetails(seg.emotion);
                    return (
                      <div
                        key={idx}
                        style={{ width: `${seg.percentage}%`, backgroundColor: details.color }}
                        title={`${seg.emotion}: ${seg.percentage.toFixed(1)}%`}
                        className="h-full transition-all duration-300 relative group"
                      />
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[#5C6B73]">
                  {segments.map((seg, idx) => {
                    const details = getEmotionDetails(seg.emotion);
                    return (
                      <span key={idx} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: details.color }} />
                        <span className="capitalize font-semibold text-[#1E252B]">{seg.emotion}</span>
                        <span>({seg.percentage.toFixed(0)}%)</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Emotion Timeline */}
            {timeline.length > 0 && (
              <div className="pt-2 border-t border-[#F1F6FC]">
                <h5 className="font-outfit font-bold text-[#1E252B] text-sm mb-2">Emotion Timeline</h5>
                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {timeline.map((item, idx) => {
                    const details = getEmotionDetails(item.emotion);
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white"
                      >
                        <span>{details.emoji}</span>
                        <span className="capitalize font-semibold text-[#1E252B]">{item.emotion}</span>
                        <span className="text-[9px] text-[#5C6B73] font-mono">{formatTime(item.timestamp)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

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

      {/* Action Footer Button */}
      <div className="p-3 border-t border-[#D2DBE3] bg-[#F8FAFC] flex justify-end shrink-0">
        <Button
          variant="primary"
          size="sm"
          type="button"
          className="px-4 py-2 font-outfit text-xs font-bold"
          onClick={onEditNote}
        >
          {hasExistingNote ? "✍️ Edit Coach Note" : "✍️ Save to Session Notes"}
        </Button>
      </div>
    </div>
  );
}
