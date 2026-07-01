"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { LiveKitApiService } from "@/services/livekit.service";
import type { LiveKitTokenResponse } from "@/types/livekit";
import SessionVideoCall from "@/components/livekit/SessionVideoCall";
import { useLiveVideoAnalysis } from "@/hooks/useLiveVideoAnalysis";
import LiveSessionTranscript from "@/components/session/LiveSessionTranscript";
import AiSessionNoteView from "@/components/session/AiSessionNoteView";
import SessionNoteEditor from "@/components/session/SessionNoteEditor";
import ChangeInsightsPanel from "@/components/session/ChangeInsightsPanel";
import { changeInsightService } from "@/services/changeInsight.service";
import { aiSessionNoteService } from "@/services/aiSessionNote.service";
import { LiveVideoAnalysisApiService } from "@/services/liveVideoAnalysis.service";
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

  const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [callInstanceKey, setCallInstanceKey] = useState(0);
  const [isJoining, setIsJoining] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const handleRemoteVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    setRemoteVideoTrack(track);
  }, []);

  // Hook up video analysis sampler (Phase 1 & 2)
  const { isSampling, latestEmotion, currentBoundingBox, startAnalysis, stopAnalysis, mediaPipeReady, usingFallback, rawScores, baselineReady } = useLiveVideoAnalysis({
    videoTrack: remoteVideoTrack,
    isEnabled: consentChecked && !callEnded && !!participantInfo,
    sessionId,
    participantId: memberId,
  });

  // AI & Transcript integration states
  const [accumulatedTranscript, setAccumulatedTranscript] = useState<TranscriptLine[]>([]);
  const [aiNote, setAiNote] = useState<AiSessionNoteDTO | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [panelView, setPanelView] = useState<"transcript" | "ai" | "editor" | "insights">("transcript");
  const [insight, setInsight] = useState<any>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [insightStatusMessage, setInsightStatusMessage] = useState<string | null>(null);

  // Emotion history state and helper map
  const [emotionHistory, setEmotionHistory] = useState<
    Array<{ emotion: string; timestamp: number }>
  >([]);

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

  const handleNoteSaved = async () => {
    setIsInsightLoading(true);
    setInsightStatusMessage(null);
    setPanelView("insights");
    try {
      const res = await changeInsightService.compare(sessionId);
      if (res.status === "success" && res.insight) {
        setInsight(res.insight);
      } else {
        setInsight(null);
        setInsightStatusMessage(res.message || "Comparison could not be completed.");
      }
    } catch (err: any) {
      console.error("[MeetingModal] Failed to run comparison:", err);
      setInsight(null);
      setInsightStatusMessage("An error occurred while generating change insights.");
    } finally {
      setIsInsightLoading(false);
    }
  };

  useEffect(() => {
    if (
      latestEmotion &&
      latestEmotion.dominantEmotion &&
      latestEmotion.dominantEmotion !== "No Face" &&
      latestEmotion.dominantEmotion !== "Camera Off"
    ) {
      const newEmotion = latestEmotion.dominantEmotion;
      setEmotionHistory((prev) => {
        const lastEntry = prev[prev.length - 1];
        if (lastEntry && lastEntry.emotion === newEmotion) {
          return prev;
        }
        return [...prev, { emotion: newEmotion, timestamp: Date.now() }];
      });
    }
  }, [latestEmotion]);

  const getQualityColor = (quality: string) => {
    if (quality === "excellent" || quality === "good") return "bg-[#68A688]";
    if (quality === "poor") return "bg-[#FF8D69]";
    return "bg-[#FF7894]";
  };

  const joinSessionCall = useCallback(async () => {
    if (isJoining) {
      console.log("[MeetingModal] Join already in progress. Ignoring duplicate request.");
      return;
    }
    setIsJoining(true);
    setLoading(true);
    setError(null);

    // 1. set callEnded = true (to unmount old room UI first)
    setCallEnded(true);

    // 2. clear token/session video config / tracks / stream / consent / participant info
    setTokenDetails(null);
    setRemoteVideoTrack(null);
    setRemoteStream(null);
    setParticipantInfo(null);
    setConsentChecked(false);

    try {
      // 3. Request fresh token
      const details = await LiveKitApiService.startSession(sessionId);

      // 5. Increment callInstanceKey
      setCallInstanceKey((prev) => prev + 1);

      // 6. Set token details (mount SessionVideoCall)
      setTokenDetails(details);
      setCallEnded(false);
    } catch (err: any) {
      console.error("[MeetingModal] API fetch failed during join:", err);
      const msg = err.response?.data?.message || err.message || "Failed to establish a connection to the video room.";
      setError(msg);
    } finally {
      setIsJoining(false);
      setLoading(false);
    }
  }, [sessionId, isJoining]);

  useEffect(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;
    joinSessionCall();
  }, [joinSessionCall]);

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
    if (isEnding) {
      console.log("[MeetingModal] End call already in progress. Ignoring duplicate click.");
      return;
    }
    setIsEnding(true);
    try {
      setIsAnalyzing(true);
      setPanelView("ai");
      setCallEnded(true);

      // Stop sampler & clear tracks, streams, token state
      setConsentChecked(false);
      setRemoteVideoTrack(null);
      setRemoteStream(null);
      setParticipantInfo(null);
      setTokenDetails(null);

      // Explicitly mark session call as ended
      try {
        await LiveKitApiService.endSession(sessionId);
        onSessionEnded?.();
      } catch (endErr) {
        console.warn("[MeetingModal] Failed to mark session call as ended:", endErr);
      }

      let finalCounts: Record<string, number> = {};
      try {
        const agg = await LiveVideoAnalysisApiService.getSessionAggregation(sessionId);
        finalCounts = agg.emotionCounts || {};
      } catch (err) {
        console.warn("[MeetingModal] Failed to fetch session aggregation from Python API, using fallback counts:", err);
        emotionHistory.forEach((item) => {
          finalCounts[item.emotion] = (finalCounts[item.emotion] || 0) + 1;
        });
      }

      // Convert emotionHistory to database format
      const finalTimeline = emotionHistory.map(h => ({
        emotion: h.emotion,
        timestamp: new Date(h.timestamp).toISOString(),
      }));

      const note = await aiSessionNoteService.create({
        memberId,
        sessionId,
        transcript: finalTranscript,
        emotionTimeline: finalTimeline,
        emotionCounts: finalCounts,
      });
      setAiNote(note);
      toast.success("AI Analysis note created and saved successfully!");
    } catch (err: any) {
      console.error("[MeetingModal] Failed to generate AI analysis:", err);
      toast.error(err.message || "Failed to analyze transcript.");
    } finally {
      setIsAnalyzing(false);
      setIsEnding(false);
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
              <>
                {process.env.NODE_ENV === "development" && latestEmotion && (
                  <div
                    className="flex items-center gap-1.5 border border-[#D2DBE3] bg-[#F8FAFC]"
                    style={{ borderRadius: "20px", padding: "4px 12px" }}
                  >
                    <span className="text-xs">
                      {latestEmotion.dominantEmotion === "Calm"
                        ? "🟢"
                        : latestEmotion.dominantEmotion === "Anxious"
                          ? "🟠"
                          : latestEmotion.dominantEmotion === "No Face"
                            ? "👤"
                            : latestEmotion.dominantEmotion === "Camera Off"
                              ? "📷"
                              : latestEmotion.dominantEmotion === "Happy"
                                ? "😊"
                                : latestEmotion.dominantEmotion === "Sad"
                                  ? "😢"
                                  : latestEmotion.dominantEmotion === "Surprise"
                                    ? "😲"
                                    : latestEmotion.dominantEmotion === "Angry"
                                      ? "😠"
                                      : latestEmotion.dominantEmotion === "Intermittent Presence"
                                        ? "🔄"
                                        : latestEmotion.dominantEmotion === "Unstable Presence"
                                          ? "🫨"
                                          : latestEmotion.dominantEmotion === "Distracted"
                                            ? "👀"
                                            : "🟡"}
                    </span>
                    <span className="font-outfit text-xs font-semibold text-[#1E252B] capitalize">
                      {latestEmotion.dominantEmotion} ({(latestEmotion.confidence * 100).toFixed(0)}%)
                    </span>
                  </div>
                )}

                {process.env.NODE_ENV === "development" && (
                  <div
                    className="flex flex-col gap-0.5 border border-amber/20 bg-amber-50 text-amber-900 font-mono text-[9px] shadow-sm leading-tight"
                    style={{ borderRadius: "10px", padding: "4px 10px" }}
                  >
                    <div>mediaPipeReady: {mediaPipeReady ? "true" : "false"}</div>
                    <div>usingFallback: {usingFallback ? "true" : "false"}</div>
                    <div>consent: {consentChecked ? "enabled" : "disabled"}</div>
                    {latestEmotion && (
                      <div>latestEmotion: {latestEmotion.dominantEmotion}</div>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 border border-[#D2DBE3] bg-[#F1F6FC] cursor-pointer select-none hover:bg-[#E2ECF5] transition-colors" style={{ borderRadius: "20px", padding: "4px 12px" }}>
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="rounded border-[#D2DBE3] text-[#4E8C58] focus:ring-[#4E8C58] h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="font-outfit text-xs font-semibold text-[#1E252B]">
                    Video Analysis Consent
                  </span>
                </label>

                <div
                  className="flex items-center gap-2 border border-[#D2DBE3]"
                  style={{ borderRadius: "20px", padding: "4px 10px", backgroundColor: "rgba(0, 0, 0, 0.05)" }}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${getQualityColor(
                      participantInfo.quality
                    )} animate-pulse`}
                  />
                  <span className="font-outfit text-sm font-semibold text-[#1E252B]">
                    {participantInfo.name}
                  </span>
                </div>
              </>
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
            ) : callEnded ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-[#0F172A]">
                <div className="w-16 h-16 rounded-full bg-[#EBF7EE]/10 flex items-center justify-center text-[#68A688] mb-4 text-2xl font-bold">
                  ✓
                </div>
                <h3 className="font-outfit font-bold text-lg text-white mb-2">Video Call Closed</h3>
                <p className="text-sm text-[#5C6B73]">This session has been completed successfully.</p>
              </div>
            ) : tokenDetails ? (
              <SessionVideoCall
                key={callInstanceKey}
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
                onRemoteVideoTrack={handleRemoteVideoTrack}
                latestEmotion={latestEmotion}
                currentBoundingBox={currentBoundingBox}
                enableFaceOverlay={consentChecked && !callEnded}
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
                <button
                  onClick={() => setPanelView("insights")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold font-outfit transition-all",
                    panelView === "insights"
                      ? "bg-white text-[#4E8C58] shadow-sm font-bold"
                      : "text-[#5C6B73] hover:text-[#1E252B]"
                  )}
                >
                  Change Insights
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
                  latestEmotion={latestEmotion}
                  rawScores={rawScores}
                  baselineReady={baselineReady}
                  emotionHistory={emotionHistory}
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
                  onSaveSuccess={handleNoteSaved}
                />
              ) : panelView === "insights" ? (
                <ChangeInsightsPanel
                  insight={insight}
                  isLoading={isInsightLoading}
                  statusMessage={insightStatusMessage}
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
