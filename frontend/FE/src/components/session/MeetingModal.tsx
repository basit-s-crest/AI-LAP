"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { LiveKitApiService } from "@/services/livekit.service";
import type { LiveKitTokenResponse } from "@/types/livekit";
import SessionVideoCall from "@/components/livekit/SessionVideoCall";
import LiveSessionTranscript from "@/components/session/LiveSessionTranscript";
import AiSessionNoteView from "@/components/session/AiSessionNoteView";
import SessionNoteEditor from "@/components/session/SessionNoteEditor";
import { aiSessionNoteService } from "@/services/aiSessionNote.service";
import type { TranscriptLine, AiSessionNoteDTO } from "@/types/sessionNote";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

interface MeetingModalProps {
  sessionId: string;
  memberId: string;
  clientName: string;
  sessionTime: string;
  sessionType?: string;
  onClose: () => void;
  onMemberTranscription?: (text: string) => void;
  onSessionEnded?: () => void;
}

export default function MeetingModal({
  sessionId,
  memberId,
  clientName,
  sessionTime,
  sessionType = "Weekly Check-in",
  onClose,
  onMemberTranscription,
  onSessionEnded,
}: MeetingModalProps) {
  const [tokenDetails, setTokenDetails] = useState<LiveKitTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchStarted = useRef(false);

  const [callTimer, setCallTimer] = useState<string | null>(null);
  const [participantInfo, setParticipantInfo] = useState<{ name: string; quality: string } | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const handleParticipantUpdate = useCallback((name: string, quality: string) => {
    setParticipantInfo((prev) => {
      if (prev?.name === name && prev?.quality === quality) return prev;
      return { name, quality };
    });
  }, []);

  const handleRemoteStream = useCallback((stream: MediaStream | null) => {
    setRemoteStream((prev) => {
      if (prev === stream) return prev;
      if (prev && stream && prev.id === stream.id) return prev;
      return stream;
    });
  }, []);

  // AI & Transcript integration states
  const [accumulatedTranscript, setAccumulatedTranscript] = useState<TranscriptLine[]>([]);
  const [aiNote, setAiNote] = useState<AiSessionNoteDTO | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [panelView, setPanelView] = useState<"transcript" | "ai" | "editor">("transcript");

  const getQualityColor = (quality: string) => {
    if (quality === "excellent" || quality === "good") return "bg-[#68A688]";
    if (quality === "poor") return "bg-[#FF8D69]";
    return "bg-[#FF7894]";
  };

  useEffect(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await LiveKitApiService.startSession(sessionId);
        setTokenDetails(details);
      } catch (err: any) {
        console.error("[MeetingModal] API fetch failed:", err);
        const msg = err.response?.data?.message || err.message || "Failed to establish a connection to the video room.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [sessionId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSessionEndAndAnalyze = async (finalTranscript: TranscriptLine[]) => {
    try {
      setIsAnalyzing(true);
      setPanelView("ai");

      // Explicitly mark session call as ended
      try {
        await LiveKitApiService.endSession(sessionId);
        onSessionEnded?.();
      } catch (endErr) {
        console.warn("[MeetingModal] Failed to mark session call as ended:", endErr);
      }

      const note = await aiSessionNoteService.create({
        memberId,
        sessionId,
        transcript: finalTranscript,
      });
      setAiNote(note);
      toast.success("AI Analysis note created and saved successfully!");
    } catch (err: any) {
      console.error("[MeetingModal] Failed to generate AI analysis:", err);
      toast.error(err.message || "Failed to analyze transcript.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4">
      <div
        className="relative w-full max-w-[1350px] w-[95vw] bg-white rounded-[24px] p-6 flex flex-col animate-up overflow-hidden"
        style={{ boxShadow: "0 32px 64px rgba(0,0,0,0.35)", height: "90vh", maxHeight: "800px" }}
      >
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between pb-4 border-b border-[#D2DBE3] mb-4">
          <div>
            <h3 className="text-[20px] font-bold text-[#1E252B] font-outfit">
              Session with {clientName}
            </h3>
            <p className="text-[13px] font-sans text-dim mt-0.5">
              Scheduled time: {sessionTime}{callTimer ? ` · ${callTimer}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {participantInfo && (
              <div
                className="flex items-center gap-2 border border-[#D2DBE3]"
                style={{ borderRadius: "20px", padding: "4px 10px", backgroundColor: "rgba(0, 0, 0, 0.05)" }}
              >
                <span
                  className={`w-2 h-2 rounded-full ${getQualityColor(
                    participantInfo.quality
                  )} animate-pulse`}
                />
                <span className="font-outfit text-sm font-semibold text-[#1E252B]">
                  {participantInfo.name}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-[#D2DBE3] text-[#5C6B73] hover:bg-[#F1F6FC] transition-colors font-semibold text-xs"
              title="Leave and Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body / Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 items-stretch">
          {/* Left: Video Call (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-center bg-[#0F172A] rounded-2xl overflow-hidden border border-[#D2DBE3] relative aspect-video lg:aspect-auto lg:h-full">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-white/95">
                <div className="w-12 h-12 border-4 border-[#68A688]/20 border-t-[#68A688] rounded-full animate-spin mb-6" />
                <h3 className="font-outfit font-bold text-xl text-[#1E252B] mb-2">Connecting to session…</h3>
                <p className="text-sm font-sans text-[#5C6B73]">Preparing secure video session credentials...</p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-white/95">
                <div className="text-4xl mb-4 text-[#FF8D69]">⚠️</div>
                <h3 className="font-outfit font-bold text-xl text-[#1E252B] mb-2">Unable to Join Call</h3>
                <p className="text-sm font-sans text-[#5C6B73] leading-relaxed mb-6 max-w-md">
                  {error}
                </p>
                <Button onClick={onClose} size="sm">
                  Close
                </Button>
              </div>
            ) : tokenDetails ? (
              <SessionVideoCall
                token={tokenDetails.token}
                serverUrl={tokenDetails.serverUrl}
                roomName={tokenDetails.roomName}
                role="coach"
                coachId={tokenDetails.coachId}
                sessionId={sessionId}
                mode="modal"
                onLeave={onClose}
                onTimerUpdate={setCallTimer}
                onParticipantUpdate={handleParticipantUpdate}
                onRemoteStream={handleRemoteStream}
              />
            ) : null}
          </div>

          {/* Right: Transcript / AI Analysis Panel (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-[350px] lg:h-full min-h-0">
            {(aiNote || isAnalyzing) && (
              <div className="flex gap-1.5 mb-3 bg-[#F1F6FC] p-1 rounded-xl shrink-0 self-start border border-[#D2DBE3]">
                <button
                  onClick={() => setPanelView("transcript")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold font-outfit transition-all",
                    panelView === "transcript"
                      ? "bg-white text-[#4E8C58] shadow-sm font-bold"
                      : "text-[#5C6B73] hover:text-[#1E252B]"
                  )}
                >
                  Transcript
                </button>
                <button
                  onClick={() => setPanelView("ai")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold font-outfit transition-all",
                    panelView === "ai"
                      ? "bg-white text-[#4E8C58] shadow-sm font-bold"
                      : "text-[#5C6B73] hover:text-[#1E252B]"
                  )}
                >
                  AI Note
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0">
              {panelView === "transcript" ? (
                <LiveSessionTranscript
                  sessionId={sessionId}
                  memberId={memberId}
                  onTranscriptChange={setAccumulatedTranscript}
                  onSessionEnd={handleSessionEndAndAnalyze}
                  isCallActive={!!participantInfo}
                  remoteStream={remoteStream}
                  onMemberTranscription={onMemberTranscription}
                  transcriptionToken={tokenDetails?.transcriptionToken}
                />
              ) : panelView === "editor" ? (
                <SessionNoteEditor
                  sessionId={sessionId}
                  memberId={memberId}
                  clientName={clientName}
                  sessionType={sessionType}
                  initialNotes={aiNote ? `• Summary: ${aiNote.summary || ""}\n• Sentiment: ${aiNote.memberSentiment || ""}\n• Observations: ${aiNote.coachObservations || ""}\n• Themes: ${(aiNote.keyThemes || []).join(", ")}` : ""}
                  initialNextSessionGoal={aiNote?.recommendedFollowUp || ""}
                  aiSessionNoteId={aiNote?.id || null}
                  onCancel={() => setPanelView("ai")}
                />
              ) : (
                <AiSessionNoteView
                  note={aiNote}
                  isLoading={isAnalyzing}
                  sessionId={sessionId}
                  onEditNote={() => setPanelView("editor")}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
