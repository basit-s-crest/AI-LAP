"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  useRoomContext,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
  RoomAudioRenderer,
  TrackReference,
  TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track, Room } from "livekit-client";

function isTrackReference(
  track: TrackReferenceOrPlaceholder | undefined
): track is TrackReference {
  return !!track && track.publication !== undefined;
}
import { Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle } from "lucide-react";

interface SessionVideoCallProps {
  token: string;
  serverUrl: string;
  roomName: string;
  role: string;
  coachId: string;
  sessionId?: string;
  mode?: "page" | "modal";
  onLeave?: () => void;
  onTimerUpdate?: (timer: string) => void;
  onParticipantUpdate?: (name: string, quality: string) => void;
  onRemoteStream?: (stream: MediaStream | null) => void;
  onRemoteVideoTrack?: (track: MediaStreamTrack | null) => void;
  latestEmotion?: { dominantEmotion: string; confidence: number } | null;
  currentBoundingBox?: { left: number; top: number; width: number; height: number } | null;
  enableFaceOverlay?: boolean;
}

const backgroundStyle = {
  background: `
    radial-gradient(circle at 10% 20%, rgba(83, 164, 208, 0.15) 0%, transparent 45%),
    radial-gradient(circle at 90% 10%, rgba(156, 138, 233, 0.12) 0%, transparent 45%),
    radial-gradient(circle at 50% 80%, rgba(83, 164, 208, 0.08) 0%, transparent 50%),
    linear-gradient(135deg, #E3EFFB 0%, #F1F6FC 50%, #E8F2FC 100%)
  `,
  backgroundAttachment: "fixed" as const,
};

const getInitials = (name?: string) => {
  if (!name) return "?";
  const cleanName = name.includes(":") ? name.split(":")[1] || name.split(":")[0] : name;
  const parts = cleanName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const getQualityColor = (quality: string) => {
  if (quality === "excellent" || quality === "good") return "bg-[#68A688]"; // sage/green
  if (quality === "poor") return "bg-[#FF8D69]"; // amber
  return "bg-[#FF7894]"; // rose/red
};

function VideoCallInterface({
  role,
  onLeave,
  mode,
  onTimerUpdate,
  onParticipantUpdate,
  onRemoteStream,
  onRemoteVideoTrack,
  latestEmotion,
  currentBoundingBox,
  enableFaceOverlay,
}: {
  role: string;
  onLeave: () => void;
  mode?: "page" | "modal";
  onTimerUpdate?: (timer: string) => void;
  onParticipantUpdate?: (name: string, quality: string) => void;
  onRemoteStream?: (stream: MediaStream | null) => void;
  onRemoteVideoTrack?: (track: MediaStreamTrack | null) => void;
  latestEmotion?: { dominantEmotion: string; confidence: number } | null;
  currentBoundingBox?: { left: number; top: number; width: number; height: number } | null;
  enableFaceOverlay?: boolean;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);
  const audioTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);

  const remoteParticipant = remoteParticipants[0];
  const remoteVideoTrack = cameraTracks.find(
    (t) => t.participant.identity === remoteParticipant?.identity
  );
  const remoteAudioTrack = audioTracks.find(t => t.participant.identity !== localParticipant.identity);
  const lastStreamIdRef = useRef<string | null>(null);

  // Extract remote participant's audio track and notify parent
  useEffect(() => {
    const trackObj = remoteAudioTrack?.publication?.track;
    const stream = trackObj?.mediaStream;

    const streamId = stream ? stream.id : null;
    if (lastStreamIdRef.current !== streamId) {
      lastStreamIdRef.current = streamId;
      if (stream) {
        onRemoteStream?.(stream);
      } else {
        onRemoteStream?.(null);
      }
    }
  }, [remoteAudioTrack, remoteAudioTrack?.publication?.track?.mediaStream, onRemoteStream]);

  const hasLoggedVideoTrackFoundRef = useRef(false);

  // Extract remote participant's video track and notify parent
  useEffect(() => {
    const trackObj = remoteVideoTrack?.publication?.track;
    const nativeTrack = (trackObj as any)?.mediaStreamTrack;
    const isMuted = remoteVideoTrack?.publication?.isMuted;
    const isSubscribed = remoteVideoTrack?.publication?.isSubscribed;

    const isTrackActive = 
      !!nativeTrack && 
      nativeTrack.readyState === "live" && 
      !nativeTrack.muted && 
      nativeTrack.enabled &&
      !isMuted &&
      isSubscribed !== false;

    if (isTrackActive) {
      if (!hasLoggedVideoTrackFoundRef.current) {
        hasLoggedVideoTrackFoundRef.current = true;
        console.log("[SessionVideoCall] Remote video track found successfully.");
      }
      onRemoteVideoTrack?.(nativeTrack);
    } else {
      if (hasLoggedVideoTrackFoundRef.current) {
        hasLoggedVideoTrackFoundRef.current = false;
        console.log("[SessionVideoCall] Remote video track removed/stopped.");
      }
      onRemoteVideoTrack?.(null);
    }
  }, [
    remoteVideoTrack, 
    remoteVideoTrack?.publication?.track, 
    remoteVideoTrack?.publication?.isMuted, 
    remoteVideoTrack?.publication?.isSubscribed, 
    onRemoteVideoTrack
  ]);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Inactivity auto-hide logic
  const resetInactivityTimer = () => {
    setShowControls(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    window.addEventListener("mousemove", resetInactivityTimer);
    timeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    return () => {
      window.removeEventListener("mousemove", resetInactivityTimer);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const onTimerUpdateRef = useRef(onTimerUpdate);
  const onParticipantUpdateRef = useRef(onParticipantUpdate);
  const lastParticipantInfo = useRef<{ name: string; quality: string } | null>(null);

  useEffect(() => {
    onTimerUpdateRef.current = onTimerUpdate;
  }, [onTimerUpdate]);

  useEffect(() => {
    onParticipantUpdateRef.current = onParticipantUpdate;
  }, [onParticipantUpdate]);

  // Timer logic
  useEffect(() => {
    if (connectionState === "connected" && remoteParticipants.length > 0) {
      const interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [connectionState, remoteParticipants.length]);

  // Sync timer with parent component
  useEffect(() => {
    const timerFn = onTimerUpdateRef.current;
    if (timerFn) {
      timerFn(formatTimer(timerSeconds));
    }
  }, [timerSeconds]);

  useEffect(() => {
    if (connectionState === "connected") {
      const name = localParticipant.name || localParticipant.identity.split(":")[0];
      const quality = localParticipant.connectionQuality;

      const last = lastParticipantInfo.current;
      if (!last || last.name !== name || last.quality !== quality) {
        lastParticipantInfo.current = { name, quality };
        const partFn = onParticipantUpdateRef.current;
        if (partFn) {
          partFn(name, quality);
        }
      }
    }
  }, [localParticipant.name, localParticipant.identity, localParticipant.connectionQuality, connectionState]);

  // Mic/Camera toggles
  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error("[VideoCallInterface] Failed to toggle mic:", err);
    }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error("[VideoCallInterface] Failed to toggle camera:", err);
    }
  };

  const hasCleanedUpRef = useRef(false);

  const handleEndCall = () => {
    if (hasCleanedUpRef.current) {
      console.log("[VideoCallInterface] Already ended call. Skipping duplicate disconnect.");
      return;
    }
    hasCleanedUpRef.current = true;

    console.log("[VideoCallInterface] Ending call. Current state:", connectionState);
    if (connectionState === "connected" || connectionState === "reconnecting") {
      try {
        room.disconnect();
      } catch (err) {
        console.warn("[VideoCallInterface] Disconnect failed safely:", err);
      }
    } else {
      console.log("[VideoCallInterface] Room already disconnected or connecting (skip disconnect). Doing nothing.");
    }
  };

  // Render RoomAudioRenderer to ensure we hear remote participants
  const audioRenderer = <RoomAudioRenderer />;

  const overlayClass = mode === "modal"
    ? "absolute inset-0 flex items-center justify-center z-50 bg-[#F8FAFC]"
    : "fixed inset-0 flex items-center justify-center z-[9999]";

  // 1. Connecting State
  if (connectionState === "connecting" || connectionState === "reconnecting") {
    return (
      <div className={overlayClass} style={mode === "modal" ? undefined : backgroundStyle}>
        {audioRenderer}
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-[#D2DBE3] rounded-[28px] shadow-[0_12px_30px_rgba(92,107,115,0.05)] max-w-md w-full mx-4 text-center">
          <div className="w-12 h-12 border-4 border-[#68A688]/20 border-t-[#68A688] rounded-full animate-spin mb-6" />
          <h3 className="font-outfit font-bold text-xl text-[#1E252B] mb-2">Connecting to session…</h3>
          <p className="text-sm font-sans text-[#5C6B73]">Establishing connection to the secure server...</p>
        </div>
      </div>
    );
  }

  // 2. Waiting State
  if (connectionState === "connected" && remoteParticipants.length === 0) {
    const waitingMsg = role === "coach" ? "Waiting for client..." : "Waiting for coach...";
    return (
      <div className={overlayClass} style={mode === "modal" ? undefined : backgroundStyle}>
        {audioRenderer}
        <div className="relative flex flex-col items-center justify-center p-12 bg-white border border-[#D2DBE3] rounded-[28px] shadow-[0_24px_50px_rgba(92,107,115,0.08)] max-w-md w-full mx-4 text-center overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[6px] bg-gradient-to-r from-[#FF7894] via-[#FF8D69] via-[#FFE180] via-[#8EE2BE] via-[#53A4D0] to-[#9C8AE9]" />
          <div className="w-12 h-12 border-4 border-[#68A688]/20 border-t-[#68A688] rounded-full animate-spin mb-6" />
          <h3 className="font-outfit font-bold text-xl text-[#1E252B] mb-2">{waitingMsg}</h3>
          <p className="text-sm font-sans text-[#5C6B73]">Your session will begin as soon as they connect.</p>
          <button
            onClick={handleEndCall}
            className="mt-8 bg-white border border-[#D2DBE3] text-[#1E252B] rounded-[12px] py-2 px-4 font-outfit font-semibold text-sm transition-all duration-150 hover:bg-[#E6EFF5]"
          >
            Cancel and Exit
          </button>
        </div>
      </div>
    );
  }

  // 3. Connected State
  const localVideoTrack = cameraTracks.find(
    (t) => t.participant.identity === localParticipant.identity
  );

  const containerClass = mode === "modal"
    ? "relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
    : "fixed inset-0 flex flex-col items-center justify-center z-[9999] overflow-hidden";

  return (
    <div className={containerClass} style={mode === "modal" ? undefined : backgroundStyle}>
      {audioRenderer}

      {/* Floating Top Bar */}
      {mode !== "modal" && (
        <div
          className="fixed top-4 left-4 right-4 z-50 transition-all duration-300"
          style={{
            opacity: showControls ? 1 : 0,
            transform: showControls ? "translateY(0)" : "translateY(-16px)",
            pointerEvents: showControls ? "auto" : "none",
          }}
        >
          <div
            className="max-w-[1200px] mx-auto bg-white border border-[#D2DBE3] shadow-[0_4px_12px_rgba(92,107,115,0.03)] rounded-[20px] flex justify-between items-center"
            style={{ padding: "14px 20px" }}
          >
            <div className="flex items-center gap-2">
              <span className="font-outfit font-bold text-xl text-[#68A688] tracking-tight">SafeCircle</span>
              <span className="h-4 w-[1px]" style={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }} />
              <span className="font-outfit text-[10px] text-[#5C6B73] font-semibold tracking-[1.5px] uppercase">Video Session</span>
            </div>

            <div className="font-outfit font-bold text-[18px] text-[#1E252B] tracking-tight">
              {formatTimer(timerSeconds)}
            </div>

            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-2 border border-[#D2DBE3]/20"
                style={{ borderRadius: "20px", padding: "4px 10px", backgroundColor: "rgba(255, 255, 255, 0.08)" }}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${getQualityColor(
                    localParticipant.connectionQuality
                  )} animate-pulse`}
                />
                <span className="font-outfit text-sm font-semibold text-[#1E252B]">
                  {localParticipant.name || localParticipant.identity.split(":")[0]}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Centered Video Card Container */}
      <div className={mode === "modal" ? "w-full h-full z-10" : "w-full h-full flex items-center justify-center p-6 md:p-12 z-10 pt-24 pb-28"}>
        <div className={mode === "modal" ? "relative w-full h-full overflow-hidden flex items-center justify-center bg-[#0F172A]" : "relative w-full max-w-[1000px] aspect-video bg-white border-4 border-white rounded-[28px] shadow-[0_24px_50px_rgba(92,107,115,0.08)] overflow-hidden flex items-center justify-center"}>

          {/* Remote Video Track */}
          {remoteVideoTrack && isTrackReference(remoteVideoTrack) ? (
            <div className="relative w-full h-full">
              <VideoTrack trackRef={remoteVideoTrack} className="w-full h-full object-cover" />
              
              {/* Bounding Box & Emotion Tag Overlay */}
              {enableFaceOverlay && currentBoundingBox && latestEmotion && (
                <div
                  className="absolute border-2 border-[#4E8C58] rounded-[8px] pointer-events-none transition-all duration-150"
                  style={{
                    left: `${currentBoundingBox.left}%`,
                    top: `${currentBoundingBox.top}%`,
                    width: `${currentBoundingBox.width}%`,
                    height: `${currentBoundingBox.height}%`,
                    boxShadow: "0 0 12px rgba(78, 140, 88, 0.4)",
                  }}
                >
                  {/* Floating Emotion Tag Pill */}
                  <div
                    className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-outfit text-[11px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap"
                    style={{
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <span>
                      {latestEmotion.dominantEmotion === "Calm"
                        ? "🟢"
                        : latestEmotion.dominantEmotion === "Neutral"
                        ? "😐"
                        : latestEmotion.dominantEmotion === "Happy"
                        ? "😊"
                        : latestEmotion.dominantEmotion === "Sad"
                        ? "😢"
                        : latestEmotion.dominantEmotion === "Anxious"
                        ? "🟠"
                        : latestEmotion.dominantEmotion === "Surprise"
                        ? "😲"
                        : latestEmotion.dominantEmotion === "Angry"
                        ? "😠"
                        : latestEmotion.dominantEmotion === "No Face"
                        ? "⚪"
                        : latestEmotion.dominantEmotion === "Camera Off"
                        ? "⚫"
                        : "🟡"}
                    </span>
                    <span>{latestEmotion.dominantEmotion}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full bg-[#0F172A] py-16">
              <div
                className="w-[88px] h-[88px] rounded-full bg-[#68A688] text-white flex items-center justify-center text-[26px] font-outfit uppercase shadow-[0_4px_12px_rgba(92,107,115,0.1)]"
                style={{ fontWeight: 700 }}
              >
                {getInitials(remoteParticipant?.name || remoteParticipant?.identity)}
              </div>
              <p
                className="mt-[14px] font-outfit text-[16px] text-white"
                style={{ fontWeight: 600 }}
              >
                {remoteParticipant?.name || remoteParticipant?.identity.split(":")[0]}
              </p>
              <p className="mt-[6px] font-sans text-[13px] font-medium text-[#5C6B73]">Camera is turned off</p>
            </div>
          )}

          {/* Local Participant (Self) Video PiP Card */}
          <div
            className="absolute bottom-4 right-4 w-[180px] h-[120px] rounded-[16px] border-2 border-white bg-white overflow-hidden z-20 transition-all duration-300"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
          >
            {isCameraEnabled && localVideoTrack ? (
              <VideoTrack trackRef={localVideoTrack as any} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full bg-[#E6EFF5]">
                <div className="w-10 h-10 rounded-full bg-[#53A4D0] text-white flex items-center justify-center text-sm font-bold font-outfit uppercase serif">
                  {getInitials(localParticipant.name || localParticipant.identity)}
                </div>
              </div>
            )}
            <span
              className="absolute bottom-2 left-2 z-30 font-outfit text-[11px] font-medium text-white px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-[2px]"
            >
              You
            </span>
          </div>
        </div>
      </div>

      {/* Floating Bottom Controls */}
      <div
        className={`${mode === "modal" ? "absolute" : "fixed"} bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
      >
        <div
          className="bg-white/85 border border-[#D2DBE3] shadow-[0_24px_50px_rgba(92,107,115,0.08)] rounded-[40px] flex items-center backdrop-blur-[16px]"
          style={{ padding: "10px 24px", gap: "10px" }}
        >
          {/* Microphone Button */}
          <button
            onClick={toggleMic}
            className={`w-[46px] h-[46px] rounded-full flex items-center justify-center transition-all duration-[150ms] ease-in-out hover:scale-105 hover:shadow-md ${isMicrophoneEnabled ? "bg-[#E6EFF5] text-[#1E252B]" : "bg-[#FFF0F2] text-[#FF7894]"
              }`}
            title={isMicrophoneEnabled ? "Mute Mic" : "Unmute Mic"}
          >
            {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          {/* Camera Button */}
          <button
            onClick={toggleCamera}
            className={`w-[46px] h-[46px] rounded-full flex items-center justify-center transition-all duration-[150ms] ease-in-out hover:scale-105 hover:shadow-md ${isCameraEnabled ? "bg-[#E6EFF5] text-[#1E252B]" : "bg-[#FFF0F2] text-[#FF7894]"
              }`}
            title={isCameraEnabled ? "Stop Camera" : "Start Camera"}
          >
            {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center bg-[#FF8D69] text-white transition-all duration-[150ms] ease-in-out hover:scale-105 hover:shadow-[0_0_15px_rgba(255,141,105,0.65)] hover:bg-[#ef7c57]"
            title="End Call"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SessionVideoCall({
  token,
  serverUrl,
  roomName,
  role,
  coachId,
  sessionId,
  mode = "page",
  onLeave,
  onTimerUpdate,
  onParticipantUpdate,
  onRemoteStream,
  onRemoteVideoTrack,
  latestEmotion,
  currentBoundingBox,
  enableFaceOverlay,
}: SessionVideoCallProps) {
  const router = useRouter();
  const [errorState, setErrorState] = useState<string | null>(null);
  const hasCleanedUpRef = useRef(false);

  const customRoom = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return new Room();
  }, []);

  const handleLeave = useCallback(() => {
    if (hasCleanedUpRef.current) {
      console.log("[SessionVideoCall] Already left/cleaned up. Ignoring duplicate leave.");
      return;
    }
    hasCleanedUpRef.current = true;
    console.log("[SessionVideoCall] handleLeave triggered. role:", role);
    if (onLeave) {
      onLeave();
    } else if (role === "coach") {
      router.push("/sessions");
    } else {
      router.push(`/coaching/${coachId}`);
    }
  }, [onLeave, role, coachId, router]);

  const handleError = useCallback((err: Error) => {
    if (err.message && (err.message.includes("Client initiated disconnect") || err.message.includes("client initiated disconnect"))) {
      console.log("[SessionVideoCall] Client initiated disconnect (normal cleanup).");
      return;
    }
    console.error("[SessionVideoCall] LiveKit connection error:", err);
    setErrorState(err.message || "Failed to establish a connection to the video room.");
  }, []);

  const handleConnected = useCallback(() => {
    console.log("[SessionVideoCall] Connected to LiveKit successfully");
  }, []);

  if (errorState) {
    const errorOverlayClass = mode === "modal"
      ? "absolute inset-0 flex items-center justify-center z-50 bg-[#F8FAFC]"
      : "fixed inset-0 flex items-center justify-center z-[9999]";
    return (
      <div className={errorOverlayClass} style={mode === "modal" ? undefined : backgroundStyle}>
        <div className="flex flex-col items-center justify-center p-8 max-w-md w-full mx-4 text-center bg-white border border-[#D2DBE3] rounded-[28px] shadow-[0_24px_50px_rgba(92,107,115,0.08)]">
          <div className="text-4xl mb-4 text-[#FF8D69] flex justify-center">
            <AlertTriangle size={48} className="text-[#FF8D69]" />
          </div>
          <h3 className="font-outfit font-bold text-xl text-[#1E252B] mb-2">Connection Error</h3>
          <p className="text-sm font-sans text-[#5C6B73] leading-relaxed mb-6 font-sans">
            {errorState}
          </p>
          <button
            onClick={handleLeave}
            className="bg-[#68A688] text-white rounded-[12px] py-2.5 px-5 font-outfit font-semibold text-sm transition-colors duration-150 hover:bg-[#589274]"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const shouldConnect = !!token && !!serverUrl && !!roomName;

  return (
    <LiveKitRoom
      room={customRoom}
      token={token}
      serverUrl={serverUrl}
      connect={shouldConnect}
      video={true}
      audio={true}
      onConnected={handleConnected}
      onError={handleError}
      onDisconnected={handleLeave}
      className="w-full h-full"
    >
      <VideoCallInterface
        role={role}
        onLeave={handleLeave}
        mode={mode}
        onTimerUpdate={onTimerUpdate}
        onParticipantUpdate={onParticipantUpdate}
        onRemoteStream={onRemoteStream}
        onRemoteVideoTrack={onRemoteVideoTrack}
        latestEmotion={latestEmotion}
        currentBoundingBox={currentBoundingBox}
        enableFaceOverlay={enableFaceOverlay}
      />
    </LiveKitRoom>
  );
}
