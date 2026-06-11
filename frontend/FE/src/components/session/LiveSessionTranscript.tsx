"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useLiveTranscription } from "@/hooks/useLiveTranscription";
import type { TranscriptLine } from "@/types/sessionNote";
import { Mic, MicOff, AlertTriangle, Play, Sparkles, Activity, Clock, Brain } from "lucide-react";

interface LiveSessionTranscriptProps {
  sessionId: string;
  memberId: string;
  onSessionEnd: (transcript: TranscriptLine[]) => void;
  onTranscriptChange?: (transcript: TranscriptLine[]) => void;
  isCallActive?: boolean;
  remoteStream?: MediaStream | null;
  onMemberTranscription?: (text: string) => void;
  transcriptionToken?: string;
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
}: LiveSessionTranscriptProps) {
  const [activeSubTab, setActiveSubTab] = useState<"transcript" | "insights">("transcript");
  const [insightsLog, setInsightsLog] = useState<{ text: string; timestamp: string }[]>([]);

  const handleLiveAnalysis = useCallback((text: string) => {
    setInsightsLog((prev) => [
      ...prev,
      { text, timestamp: new Date().toISOString() },
    ]);
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
    handleLiveAnalysis
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
          <div className="space-y-6">
            {insightsLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[280px] text-center p-8 space-y-4">
                <div className="w-16 h-16 bg-white border border-[#D2DBE3] rounded-2xl flex items-center justify-center text-dim shadow-sm">
                  <Brain size={28} className="text-[#8D99AE] animate-pulse" />
                </div>
                <h4 className="font-outfit font-bold text-[#3A4550]">Awaiting Clinical Observations</h4>
                <p className="text-xs font-sans text-soft max-w-[280px] leading-relaxed">
                  Real-time clinical insights will populate here automatically every 5 lines or 40 words spoken by the member.
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

                {/* Latest Insight Card */}
                <div className="bg-gradient-to-br from-white to-[#F8FAFC] border-[1.5px] border-[#D2DBE3] rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#EBF7EE]/30 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
                  <div className="flex items-center gap-1.5 text-xs font-outfit font-bold text-[#4E8C58]">
                    <Sparkles size={14} />
                    <span>LATEST CLINICAL OBSERVATION</span>
                  </div>
                  <p className="text-sm font-sans text-ink leading-relaxed font-semibold">
                    {insightsLog[insightsLog.length - 1].text}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-soft font-mono font-semibold pt-2 border-t border-[#D2DBE3]/50">
                    <Clock size={10} />
                    <span>Updated at {formatTime(insightsLog[insightsLog.length - 1].timestamp)}</span>
                  </div>
                </div>

                {/* History Timeline */}
                {insightsLog.length > 1 && (
                  <div className="space-y-4 pt-2">
                    <h5 className="font-outfit font-bold text-[#3A4550] text-[10.5px] uppercase tracking-wider">
                      Observation History
                    </h5>
                    <div className="space-y-3 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#D2DBE3]/70">
                      {insightsLog.slice(0, -1).reverse().map((insight, idx) => (
                        <div key={idx} className="flex gap-4 relative">
                          <div className="w-9 h-9 rounded-full bg-white border-2 border-[#D2DBE3] flex items-center justify-center shrink-0 z-10 shadow-sm text-dim">
                            <Brain size={14} className="text-[#8D99AE]" />
                          </div>
                          <div className="bg-white border border-[#D2DBE3]/75 rounded-xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex-1 space-y-1.5">
                            <p className="text-xs font-sans text-[#5C6B73] leading-relaxed">
                              {insight.text}
                            </p>
                            <div className="flex items-center gap-1 text-[9px] text-soft font-mono">
                              <Clock size={8} />
                              <span>{formatTime(insight.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
