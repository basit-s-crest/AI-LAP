"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useLiveTranscription } from "@/hooks/useLiveTranscription";
import type { TranscriptLine } from "@/types/sessionNote";
import { Mic, MicOff, AlertTriangle, Play, Sparkles, Activity, Clock, Brain, BarChart3, Waves, Zap, AlertCircle } from "lucide-react";
import { LiveVideoAnalysisApiService, type SessionAggregationResponse } from "@/services/liveVideoAnalysis.service";

interface LiveSessionTranscriptProps {
  sessionId: string;
  memberId: string;
  onSessionEnd: (transcript: TranscriptLine[]) => void;
  onTranscriptChange?: (transcript: TranscriptLine[]) => void;
  isCallActive?: boolean;
  remoteStream?: MediaStream | null;
  onMemberTranscription?: (text: string) => void;
  transcriptionToken?: string;
  latestEmotion?: any;
  rawScores?: Record<string, number> | null;
  baselineReady?: boolean;
  emotionHistory?: Array<{ emotion: string; timestamp: number }>;
}

const formatTime = (isoString: string) => {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "00:00:00";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return "00:00:00";
  }
};

// ── RAG insight parser ────────────────────────────────────────────────────────
type RiskTier = "LOW" | "MODERATE" | "HIGH" | "CRISIS";

interface ParsedInsight {
  tier: RiskTier | null;
  sentimentSummary: string | null;
  questions: string[];
}

const TIER_STYLES: Record<RiskTier, { bg: string; text: string; border: string; label: string }> = {
  LOW:      { bg: "bg-[#EBF7EE]", text: "text-[#2E7D32]", border: "border-[#C8E6C9]", label: "LOW RISK" },
  MODERATE: { bg: "bg-[#FFF8E1]", text: "text-[#F57F17]", border: "border-[#FFE082]", label: "MODERATE RISK" },
  HIGH:     { bg: "bg-[#FFF3E0]", text: "text-[#E65100]", border: "border-[#FFCC80]", label: "HIGH RISK" },
  CRISIS:   { bg: "bg-[#FFEBEE]", text: "text-[#B71C1C]", border: "border-[#EF9A9A]", label: "CRISIS" },
};

function parseInsight(text: string): ParsedInsight {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  let tier: RiskTier | null = null;
  let sentimentSummary: string | null = null;
  const questions: string[] = [];

  for (const line of lines) {
    // Match tier tag — handles [LOW], [MODERATE], [HIGH], [CRISIS] anywhere in the line
    const tierMatch = line.match(/\[(LOW|MODERATE|HIGH|CRISIS)\]/i);
    if (tierMatch && !tier) {
      tier = tierMatch[1].toUpperCase() as RiskTier;
      continue;
    }
    // Strip leading bullet characters (•, -, *, digits+dot) then add non-empty lines
    const cleaned = line.replace(/^[\u2022\-\*]\s*/, "").replace(/^\d+\.\s*/, "").trim();
    if (cleaned) {
      // First non-tier, non-bullet line is the sentiment summary
      if (!sentimentSummary && !cleaned.endsWith("?")) {
        sentimentSummary = cleaned;
      } else {
        questions.push(cleaned);
      }
    }
  }

  return { tier, sentimentSummary, questions };
}

// ── Tone data types ────────────────────────────────────────────────────────────────────────
interface ToneData {
  pitch_mean: number;
  pitch_std: number;
  energy_mean: number;
  energy_trend: 'rising' | 'falling' | 'stable';
  speech_rate_wpm: number;
  pause_ratio: number;
  affect_label: string;
  congruence_score: number;
  incongruence_flag: boolean;
  text_sentiment_score: number;
  vocal_markers: string[];
}

interface InsightEntry {
  type: 'analysis';
  timestamp: string;
  analysis: string;
  tone: ToneData | null;
  // Parsed from analysis text
  tier: RiskTier | null;
  sentimentSummary: string | null;
  questions: string[];
}

const AFFECT_STYLES: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
  calm:         { bg: "bg-[#EBF7EE]", text: "text-[#2E7D32]", border: "border-[#C8E6C9]", emoji: "😌" },
  neutral:      { bg: "bg-[#F1F6FC]", text: "text-[#3A6E99]", border: "border-[#D4E8F5]", emoji: "😐" },
  elevated:     { bg: "bg-[#FFF8E1]", text: "text-[#F57F17]", border: "border-[#FFE082]", emoji: "😄" },
  flat:         { bg: "bg-[#ECEFF1]", text: "text-[#455A64]", border: "border-[#B0BEC5]", emoji: "😶" },
  nervous:      { bg: "bg-[#FFF3E0]", text: "text-[#E65100]", border: "border-[#FFCC80]", emoji: "😰" },
  distressed:   { bg: "bg-[#FFEBEE]", text: "text-[#B71C1C]", border: "border-[#EF9A9A]", emoji: "😟" },
  incongruent:  { bg: "bg-[#F3E5F5]", text: "text-[#6A1B9A]", border: "border-[#CE93D8]", emoji: "🎭" },
};

const VOCAL_MARKER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  laughter:    { bg: "bg-[#FFF8E1]", text: "text-[#F57F17]", label: "😂 Laughter" },
  sigh:        { bg: "bg-[#E3F2FD]", text: "text-[#1565C0]", label: "😮‍💨 Sighing" },
  voice_break: { bg: "bg-[#FBE9E7]", text: "text-[#BF360C]", label: "🗣️ Voice Break" },
};

const COACH_TRANSCRIPT_STUB: TranscriptLine[] = [];
const startCoachListeningStub = async () => {};
const stopCoachListeningStub = () => {};
const clearCoachTranscriptStub = () => {};

const areTranscriptsEqual = (a: TranscriptLine[], b: TranscriptLine[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].speaker !== b[i].speaker ||
      a[i].text !== b[i].text ||
      a[i].timestamp !== b[i].timestamp ||
      a[i].isFinal !== b[i].isFinal
    ) {
      return false;
    }
  }
  return true;
};

export default function LiveSessionTranscript({
  sessionId,
  memberId,
  onSessionEnd,
  onTranscriptChange,
  isCallActive,
  remoteStream,
  onMemberTranscription,
  transcriptionToken,
  latestEmotion,
  rawScores,
  baselineReady,
  emotionHistory = [],
}: LiveSessionTranscriptProps) {
  const [activeSubTab, setActiveSubTab] = useState<"transcript" | "insights">("transcript");
  const [insightsLog, setInsightsLog] = useState<InsightEntry[]>([]);
  const [aggregation, setAggregation] = useState<SessionAggregationResponse | null>(null);

  const getEmotionEmoji = (emotion: string): string => {
    const map: Record<string, string> = {
      Happy: "😊",
      Sad: "😢",
      Angry: "😠",
      Fear: "😨",
      Neutral: "😐",
      Calm: "😌",
      Anxious: "😰",
      Surprise: "😲",
      Disgust: "🤢",
      Distracted: "👀",
      "Unstable Presence": "⚠️",
      "No Face": "👤",
      "Camera Off": "📷",
      "Intermittent Presence": "🔄",
    };
    return map[emotion] || "🟡";
  };

  // Merge backend aggregation counts and client-side history counts
  const displayEmotionCounts = useMemo(() => {
    const counts: Record<string, number> = { ...(aggregation?.emotionCounts || {}) };
    if (emotionHistory) {
      emotionHistory.forEach((item) => {
        counts[item.emotion] = (counts[item.emotion] || 0) + 1;
      });
    }
    return counts;
  }, [aggregation?.emotionCounts, emotionHistory]);

  const isDev = process.env.NODE_ENV === "development";

  // Poll aggregation from python backend when on insights tab in development mode
  useEffect(() => {
    if (!isDev || activeSubTab !== "insights" || !isCallActive) {
      return;
    }

    const fetchAggregation = async () => {
      try {
        const data = await LiveVideoAnalysisApiService.getSessionAggregation(sessionId);
        setAggregation(data);
      } catch (err) {
        console.warn("[LiveSessionTranscript] Failed to fetch session aggregation:", err);
      }
    };

    // Fetch immediately
    fetchAggregation();

    // Poll every 5 seconds
    const interval = setInterval(fetchAggregation, 5000);
    return () => clearInterval(interval);
  }, [activeSubTab, sessionId, isCallActive, isDev]);

  const handleLiveAnalysis = useCallback((text: string, tone?: any) => {
    const parsed = parseInsight(text);
    const entry: InsightEntry = {
      type: 'analysis',
      timestamp: new Date().toISOString(),
      analysis: text,
      tone: tone || null,
      tier: parsed.tier,
      sentimentSummary: parsed.sentimentSummary,
      questions: parsed.questions,
    };
    setInsightsLog((prev) => [...prev, entry]);
  }, []);

  const {
    transcript: memberTranscript,
    isListening: isMemberListening,
    isSupported: isMemberSupported,
    startListening: startMemberListening,
    stopListening: stopMemberListening,
    clearTranscript: clearMemberTranscript,
  } = useLiveTranscription(
    "member",
    remoteStream,
    onMemberTranscription,
    sessionId,
    transcriptionToken,
    handleLiveAnalysis,
    latestEmotion
  );

  // Coach audio transcription is disabled right now (scope restriction)
  const coachTranscript = COACH_TRANSCRIPT_STUB;
  const isCoachListening = false;
  const isCoachSupported = true;
  const startCoachListening = startCoachListeningStub;
  const stopCoachListening = stopCoachListeningStub;
  const clearCoachTranscript = clearCoachTranscriptStub;

  const isSupported = isMemberSupported;

  const [isRecordingActive, setIsRecordingActive] = useState(false);

  // Coach local microphone control
  useEffect(() => {
    if (isRecordingActive) {
      setInsightsLog([]); // Clear live insights on recording start
      startCoachListening().catch(err => console.error('[STT] coach mic failed:', err));
    } else {
      stopCoachListening();
    }
    return () => {
      stopCoachListening();
    };
  }, [isRecordingActive, startCoachListening, stopCoachListening]);

  // Remote member audio stream control
  useEffect(() => {
    if (isRecordingActive && remoteStream) {
      startMemberListening().catch(err => console.error('[STT] member mic failed:', err));
    } else {
      stopMemberListening();
    }
    return () => {
      stopMemberListening();
    };
  }, [isRecordingActive, remoteStream, startMemberListening, stopMemberListening]);

  // Merge and sort the transcripts by timestamp ascending
  const unifiedTranscript = useMemo(() => {
    return [...memberTranscript, ...coachTranscript].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [memberTranscript, coachTranscript]);

  // Check if there's at least one final line to enable the end session button
  const hasFinalLine = useMemo(() => {
    return unifiedTranscript.some((line) => line.isFinal);
  }, [unifiedTranscript]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when the transcript updates
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [unifiedTranscript]);

  const lastSyncedTranscriptRef = useRef<TranscriptLine[]>([]);

  // Sync the latest unified transcript with the parent component
  useEffect(() => {
    if (onTranscriptChange && !areTranscriptsEqual(lastSyncedTranscriptRef.current, unifiedTranscript)) {
      lastSyncedTranscriptRef.current = unifiedTranscript;
      onTranscriptChange(unifiedTranscript);
    }
  }, [unifiedTranscript, onTranscriptChange]);

  const handleEndSession = () => {
    // Call the parent handler with the fully merged and sorted final transcript
    onSessionEnd(unifiedTranscript);
  };

  const toggleMemberMic = () => {
    if (isMemberListening) {
      stopMemberListening();
    } else {
      startMemberListening().catch(err => console.error('[STT] mic error:', err));
    }
  };

  const toggleCoachMic = () => {
    if (isCoachListening) {
      stopCoachListening();
    } else {
      startCoachListening().catch(err => console.error('[STT] mic error:', err));
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F4F8] border border-[#D2DBE3] rounded-[20px] overflow-hidden shadow-[0_4px_24px_rgba(60,50,40,0.04)]">
      {/* 1. Header & Warning Banner */}
      {!isSupported && (
        <div className="flex items-center gap-3 bg-amber-light border-b border-amber/20 px-6 py-3.5 text-[#B35A38]">
          <AlertTriangle size={18} className="shrink-0 text-amber" />
          <span className="text-xs font-sans font-semibold">
            Speech recognition is not supported in this browser. Use Chrome for best results.
          </span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-[#D2DBE3] bg-[#E4ECF4] shrink-0 p-1">
        <button
          onClick={() => setActiveSubTab("transcript")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[14px] text-xs font-bold font-outfit uppercase tracking-wider transition-all duration-150 ${
            activeSubTab === "transcript"
              ? "bg-white text-[#3A6E99] shadow-sm font-bold"
              : "text-[#5C6B73] hover:text-[#1E252B] hover:bg-white/40"
          }`}
        >
          <Mic size={14} />
          <span>Live Transcript</span>
        </button>
        <button
          onClick={() => setActiveSubTab("insights")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[14px] text-xs font-bold font-outfit uppercase tracking-wider transition-all duration-150 relative ${
            activeSubTab === "insights"
              ? "bg-white text-[#4E8C58] shadow-sm font-bold"
              : "text-[#5C6B73] hover:text-[#1E252B] hover:bg-white/40"
          }`}
        >
          <Sparkles size={14} className={activeSubTab === "insights" ? "text-[#4E8C58]" : "text-[#5C6B73]"} />
          <span>AI Insights</span>
          {insightsLog.length > 0 && activeSubTab !== "insights" && (
            <span className="absolute right-3 w-2 h-2 rounded-full bg-[#FF7894] animate-pulse" />
          )}
        </button>
      </div>

      {/* 2. Scrollable Content Feed */}
      <div
        ref={scrollContainerRef}
        className="flex-grow overflow-y-auto px-6 py-6 min-h-0 scroll-smooth"
      >
        {activeSubTab === "transcript" ? (
          <div className="space-y-4">
            {unifiedTranscript.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3">
                <div className="w-12 h-12 bg-white border border-[#D2DBE3] rounded-full flex items-center justify-center text-dim shadow-sm">
                  <Mic size={20} className="text-[#8D99AE]" />
                </div>
                <h4 className="font-outfit font-bold text-[#3A4550]">No conversation logged yet</h4>
                <p className="text-xs font-sans text-soft max-w-[280px] leading-relaxed">
                  Turn on the microphones below to start transcribing speech in real time.
                </p>
              </div>
            ) : (
              unifiedTranscript.map((line, idx) => {
                const isCoach = line.speaker === "coach";
                return (
                  <div
                    key={`${line.timestamp}-${idx}`}
                    className={`flex flex-col ${isCoach ? "items-end" : "items-start"} space-y-1`}
                  >
                    {/* Speaker Indicator & Time */}
                    <div className="flex items-center gap-2 text-[10px] font-sans font-semibold text-soft">
                      {isCoach ? (
                        <>
                          <span>{formatTime(line.timestamp)}</span>
                          <span className="px-2 py-0.5 rounded bg-sage-light text-sage font-bold">
                            Coach
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded bg-[#D4E8F5] text-[#3A6E99] font-bold">
                            Member
                          </span>
                          <span>{formatTime(line.timestamp)}</span>
                        </>
                      )}
                    </div>

                    {/* Speech Text Bubble */}
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-[16px] text-sm shadow-[0_1px_3px_rgba(0,0,0,0.02)] border ${
                        isCoach
                          ? "bg-white border-sage/10 text-ink rounded-tr-none"
                          : "bg-white border-[#D2DBE3]/50 text-ink rounded-tl-none"
                      } ${
                        !line.isFinal
                          ? "italic text-dim bg-gray-50/50 border-dashed border-dim/20"
                          : ""
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{line.text}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Emotional Climate Panel (Dev/Debug Flag Gated) */}
            {isDev && (
              <div className="bg-white border border-[#D2DBE3] rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-[#D2DBE3]/50 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-outfit font-bold text-[#3A6E99]">
                    <Activity size={14} className="text-[#3A6E99]" />
                    <span>EMOTION & PRESENCE SIGNALS (DEBUG)</span>
                  </div>
                  {aggregation?.lastUpdatedAt && (
                    <span className="text-[10px] text-soft font-mono font-semibold">
                      Updated: {formatTime(aggregation.lastUpdatedAt)}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#F8FAFC] border border-[#D2DBE3]/50 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] font-sans font-semibold text-soft block uppercase tracking-wider">
                      Current State
                    </span>
                    <div className="font-outfit font-bold text-ink flex items-center gap-1.5">
                      {getEmotionEmoji(latestEmotion?.dominantEmotion || aggregation?.dominantEmotion || "")} {latestEmotion?.dominantEmotion || aggregation?.dominantEmotion || "—"}
                    </div>
                  </div>
                  
                  <div className="bg-[#F8FAFC] border border-[#D2DBE3]/50 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] font-sans font-semibold text-[#5C6B73] block uppercase tracking-wider">
                      Baseline Ready
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      baselineReady ? "bg-[#EBF7EE] text-[#2E7D32]" : "bg-gray-100 text-gray-700"
                    }`}>
                      {baselineReady ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                <div className="text-[9px] text-[#5C6B73] italic border-t border-[#D2DBE3]/50 pt-1.5">
                  Disclaimer: Signals represent lightweight, non-clinical behavioral markers.
                </div>
              </div>
            )}

            {insightsLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[280px] text-center p-8 space-y-4">
                <div className="w-16 h-16 bg-white border border-[#D2DBE3] rounded-2xl flex items-center justify-center text-dim shadow-sm">
                  <Brain size={28} className="text-[#8D99AE] animate-pulse" />
                </div>
                <h4 className="font-outfit font-bold text-[#3A4550]">Awaiting Clinical Observations</h4>
                <p className="text-xs font-sans text-soft max-w-[280px] leading-relaxed">
                  Real-time clinical insights with vocal tone analysis will populate here automatically every 5 lines or 40 words spoken by the member.
                </p>
              </div>
            ) : (
              <>
                {/* Active Indicator Banner */}
                <div className="flex items-center justify-between bg-[#EBF7EE] border border-[#C8E6C9] rounded-xl px-4 py-2.5 text-[#2E7D32]">
                  <div className="flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-wider">
                    <Activity size={14} className="animate-pulse" />
                    <span>Live AI Monitoring Active</span>
                  </div>
                  <span className="text-[10px] bg-white/60 px-2 py-0.5 rounded font-mono font-bold">
                    {insightsLog.length} {insightsLog.length === 1 ? 'Insight' : 'Insights'}
                  </span>
                </div>

                {/* ═══ UNIFIED TIMELINE ═══ */}
                <div className="space-y-4 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-[#D2DBE3] before:to-[#D2DBE3]/30">
                  {[...insightsLog].reverse().map((entry, idx) => {
                    const isLatest = idx === 0;
                    const affectStyle = entry.tone ? (AFFECT_STYLES[entry.tone.affect_label] || AFFECT_STYLES.neutral) : null;
                    const tierStyle = entry.tier ? TIER_STYLES[entry.tier] : null;

                    return (
                      <div
                        key={`${entry.timestamp}-${idx}`}
                        className={`flex gap-4 relative transition-all duration-500 ${
                          isLatest ? "animate-[slideIn_0.4s_ease-out]" : ""
                        }`}
                      >
                        {/* Timeline Node */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm border-2 ${
                          isLatest
                            ? "bg-gradient-to-br from-[#4E8C58] to-[#68A688] border-white text-white"
                            : "bg-white border-[#D2DBE3] text-[#8D99AE]"
                        }`}>
                          {entry.tone ? <Waves size={14} /> : <Brain size={14} />}
                        </div>

                        {/* Card */}
                        <div className={`flex-1 rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden ${
                          isLatest
                            ? "bg-gradient-to-br from-white to-[#F8FAFC] border-[1.5px] border-[#D2DBE3]"
                            : "bg-white border-[#D2DBE3]/75"
                        }`}>
                          {/* Card Header */}
                          <div className={`px-4 py-2.5 flex items-center justify-between border-b border-[#D2DBE3]/50 ${
                            isLatest ? "bg-[#F8FAFC]" : ""
                          }`}>
                            <div className="flex items-center gap-2">
                              {isLatest && (
                                <span className="text-[9px] font-outfit font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#4E8C58] text-white">
                                  Latest
                                </span>
                              )}
                              {tierStyle && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-outfit font-bold uppercase tracking-wider border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}>
                                  {tierStyle.label}
                                </span>
                              )}
                              {affectStyle && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-outfit font-bold uppercase tracking-wider border ${affectStyle.bg} ${affectStyle.text} ${affectStyle.border}`}>
                                  <span>{affectStyle.emoji}</span>
                                  <span>{entry.tone?.affect_label}</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-soft font-mono font-semibold">
                              <Clock size={9} />
                              <span>{formatTime(entry.timestamp)}</span>
                            </div>
                          </div>

                          {/* Incongruence Alert */}
                          {entry.tone?.incongruence_flag && (
                            <div className="mx-3 mt-3 flex items-start gap-2 bg-[#F3E5F5] border border-[#CE93D8] rounded-xl px-3 py-2.5">
                              <AlertCircle size={16} className="text-[#6A1B9A] shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <span className="text-[10px] font-outfit font-bold text-[#6A1B9A] uppercase tracking-wider block">
                                  ⚠️ Affect Incongruence Detected
                                </span>
                                <span className="text-[11px] font-sans text-[#4A148C] leading-relaxed block">
                                  Words and vocal tone don&apos;t align — possible deflection, masking, or emotional suppression.
                                  {entry.tone.text_sentiment_score < -0.3 && entry.tone.vocal_markers.includes('laughter') &&
                                    " Negative verbal content paired with laughter may indicate coping through humor."
                                  }
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Tone Metrics Row */}
                          {entry.tone && (
                            <div className="px-4 pt-3">
                              <div className="grid grid-cols-4 gap-2">
                                {/* Speech Rate */}
                                <div className="bg-[#F8FAFC] border border-[#D2DBE3]/50 rounded-lg p-2 text-center">
                                  <div className="text-[8px] font-sans font-semibold text-soft uppercase tracking-wider">Rate</div>
                                  <div className="text-[12px] font-outfit font-bold text-ink">{entry.tone.speech_rate_wpm}<span className="text-[8px] text-soft"> wpm</span></div>
                                </div>
                                {/* Energy */}
                                <div className="bg-[#F8FAFC] border border-[#D2DBE3]/50 rounded-lg p-2 text-center">
                                  <div className="text-[8px] font-sans font-semibold text-soft uppercase tracking-wider">Energy</div>
                                  <div className="text-[12px] font-outfit font-bold text-ink flex items-center justify-center gap-1">
                                    {entry.tone.energy_trend === 'rising' ? '↑' : entry.tone.energy_trend === 'falling' ? '↓' : '→'}
                                    <span className="text-[9px] text-soft capitalize">{entry.tone.energy_trend}</span>
                                  </div>
                                </div>
                                {/* Pause Ratio */}
                                <div className="bg-[#F8FAFC] border border-[#D2DBE3]/50 rounded-lg p-2 text-center">
                                  <div className="text-[8px] font-sans font-semibold text-soft uppercase tracking-wider">Pauses</div>
                                  <div className="text-[12px] font-outfit font-bold text-ink">{Math.round(entry.tone.pause_ratio * 100)}%</div>
                                </div>
                                {/* Congruence */}
                                <div className={`rounded-lg p-2 text-center border ${
                                  entry.tone.congruence_score < 0.4
                                    ? "bg-[#F3E5F5] border-[#CE93D8]"
                                    : entry.tone.congruence_score < 0.7
                                    ? "bg-[#FFF8E1] border-[#FFE082]"
                                    : "bg-[#EBF7EE] border-[#C8E6C9]"
                                }`}>
                                  <div className="text-[8px] font-sans font-semibold text-soft uppercase tracking-wider">Match</div>
                                  <div className={`text-[12px] font-outfit font-bold ${
                                    entry.tone.congruence_score < 0.4 ? "text-[#6A1B9A]" :
                                    entry.tone.congruence_score < 0.7 ? "text-[#F57F17]" : "text-[#2E7D32]"
                                  }`}>
                                    {Math.round(entry.tone.congruence_score * 100)}%
                                  </div>
                                </div>
                              </div>

                              {/* Vocal Markers */}
                              {entry.tone.vocal_markers.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {entry.tone.vocal_markers.map((marker) => {
                                    const style = VOCAL_MARKER_STYLES[marker];
                                    return style ? (
                                      <span key={marker} className={`text-[9px] font-sans font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                                        {style.label}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sentiment Summary */}
                          {entry.sentimentSummary && (
                            <div className="px-4 pt-2.5">
                              <p className={`text-[11.5px] font-sans leading-relaxed italic ${
                                entry.tone?.incongruence_flag ? "text-[#6A1B9A]" : "text-[#37474F]"
                              }`}>
                                &ldquo;{entry.sentimentSummary}&rdquo;
                              </p>
                            </div>
                          )}

                          {/* Suggested Questions */}
                          {entry.questions.length > 0 && (
                            <div className="px-4 pt-2.5 pb-3.5">
                              <div className="flex items-center gap-1.5 text-[10px] font-outfit font-bold text-[#4E8C58] mb-2 uppercase tracking-wider">
                                <Sparkles size={11} />
                                <span>Suggested Questions</span>
                              </div>
                              <ul className="space-y-1.5">
                                {entry.questions.map((q, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className={`mt-[2px] shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                      isLatest
                                        ? "bg-[#EBF7EE] border border-[#C8E6C9] text-[#4E8C58]"
                                        : "bg-[#F0F4F8] border border-[#D2DBE3] text-[#5C6B73]"
                                    }`}>
                                      {i + 1}
                                    </span>
                                    <span className={`text-[12px] font-sans leading-relaxed ${
                                      isLatest ? "text-ink" : "text-[#5C6B73]"
                                    }`}>{q}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Bottom Controls Bar */}
      <div className="bg-white border-t border-[#D2DBE3] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        {!isRecordingActive ? (
          <button
            onClick={() => setIsRecordingActive(true)}
            disabled={!isCallActive}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[12px] font-outfit font-bold text-xs tracking-wide uppercase transition-all duration-150 w-full text-white shadow-sm ${
              isCallActive
                ? "bg-[#4E8C58] hover:bg-[#3d6e45] cursor-pointer"
                : "bg-gray-300 text-gray-500 cursor-not-allowed border border-[#D2DBE3]"
            }`}
          >
            <Play size={14} fill="currentColor" />
            <span>Start Recording</span>
          </button>
        ) : (
          /* End & Analyze Action Button */
          <button
            onClick={handleEndSession}
            disabled={!hasFinalLine}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[12px] font-outfit font-bold text-xs tracking-wide uppercase transition-all duration-150 w-full sm:w-auto ${
              hasFinalLine
                ? "bg-[#FF7894] hover:bg-[#FF5C7D] text-white shadow-sm hover:-translate-y-[1px] active:translate-y-0"
                : "bg-[#F0F4F8] text-dim border border-[#D2DBE3] cursor-not-allowed"
            }`}
          >
            <Play size={14} fill={hasFinalLine ? "currentColor" : "none"} />
            <span>End Session & Analyse</span>
          </button>
        )}
      </div>
    </div>
  );
}
