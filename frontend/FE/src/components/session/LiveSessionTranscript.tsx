"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useLiveTranscription } from "@/hooks/useLiveTranscription";
import type { TranscriptLine } from "@/types/sessionNote";
import { Mic, MicOff, AlertTriangle, Play } from "lucide-react";

interface LiveSessionTranscriptProps {
  sessionId: string;
  memberId: string;
  onSessionEnd: (transcript: TranscriptLine[]) => void;
  onTranscriptChange?: (transcript: TranscriptLine[]) => void;
  isCallActive?: boolean;
  remoteStream?: MediaStream | null;
  onMemberTranscription?: (text: string) => void;
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

export default function LiveSessionTranscript({
  sessionId,
  memberId,
  onSessionEnd,
  onTranscriptChange,
  isCallActive,
  remoteStream,
  onMemberTranscription,
}: LiveSessionTranscriptProps) {
  const {
    transcript: memberTranscript,
    isListening: isMemberListening,
    isSupported: isMemberSupported,
    startListening: startMemberListening,
    stopListening: stopMemberListening,
    clearTranscript: clearMemberTranscript,
  } = useLiveTranscription("member", remoteStream, onMemberTranscription);

  const {
    transcript: coachTranscript,
    isListening: isCoachListening,
    isSupported: isCoachSupported,
    startListening: startCoachListening,
    stopListening: stopCoachListening,
    clearTranscript: clearCoachTranscript,
  } = useLiveTranscription("coach");

  const isSupported = isMemberSupported && isCoachSupported;

  const [isRecordingActive, setIsRecordingActive] = useState(false);

  // Coach local microphone control
  useEffect(() => {
    if (isRecordingActive) {
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

  // Sync the latest unified transcript with the parent component
  useEffect(() => {
    if (onTranscriptChange) {
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

      {/* 2. Scrollable Transcript Feed */}
      <div
        ref={scrollContainerRef}
        className="flex-grow overflow-y-auto px-6 py-6 space-y-4 min-h-0 scroll-smooth"
      >
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
