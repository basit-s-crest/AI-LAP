"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppSelector } from "@/hooks/redux";
import { LiveKitApiService } from "@/services/livekit.service";
import type { LiveKitTokenResponse } from "@/types/livekit";
import SessionVideoCall from "@/components/livekit/SessionVideoCall";
import { AlertTriangle } from "lucide-react";

const backgroundStyle = {
  background: `
    radial-gradient(circle at 10% 20%, rgba(83, 164, 208, 0.15) 0%, transparent 45%),
    radial-gradient(circle at 90% 10%, rgba(156, 138, 233, 0.12) 0%, transparent 45%),
    radial-gradient(circle at 50% 80%, rgba(83, 164, 208, 0.08) 0%, transparent 50%),
    linear-gradient(135deg, #E3EFFB 0%, #F1F6FC 50%, #E8F2FC 100%)
  `,
  backgroundAttachment: "fixed" as const,
};

export default function VideoCallPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const role = useAppSelector((s) => s.auth.user?.role);

  const [tokenDetails, setTokenDetails] = useState<LiveKitTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchStarted = useRef(false);

  useEffect(() => {
    console.log("[VideoCallPage] useEffect triggered. sessionId:", sessionId, "role:", role);
    if (!sessionId || !role) {
      console.log("[VideoCallPage] Delaying fetch: sessionId or role not hydrated yet.");
      return;
    }
    if (fetchStarted.current) {
      console.log("[VideoCallPage] Fetch already initiated. Skipping duplicate request.");
      return;
    }
    fetchStarted.current = true;

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log("[VideoCallPage] Initiating API call for role:", role);

        let details: LiveKitTokenResponse;
        if (role === "coach") {
          details = await LiveKitApiService.startSession(sessionId);
        } else if (role === "user") {
          details = await LiveKitApiService.getToken(sessionId);
        } else {
          console.warn("[VideoCallPage] Forbidden role:", role);
          setError("Forbidden: Your role does not have permission to join session calls.");
          setLoading(false);
          return;
        }

        console.log("[VideoCallPage] API fetch successful. Room:", details.roomName, "URL:", details.serverUrl);
        setTokenDetails(details);
      } catch (err: any) {
        console.error("[VideoCallPage] API fetch failed:", err);
        const errMsg = err.response?.data?.message || err.message || "Failed to establish a connection to the video room.";
        if (errMsg.includes("has not been started by the coach yet")) {
          setError("Waiting for coach to start the meeting.");
        } else {
          setError(errMsg);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [sessionId, role]);

  const handleBack = () => {
    if (role === "coach") {
      router.push("/sessions");
    } else {
      const coachId = tokenDetails?.coachId || "";
      if (coachId) {
        router.push(`/coaching/${coachId}`);
      } else {
        router.push("/dashboard");
      }
    }
  };

  // 1. Initial Loading State (Before API Token Retrieval)
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[9999]" style={backgroundStyle}>
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-[#D2DBE3] rounded-[28px] shadow-[0_12px_30px_rgba(92,107,115,0.05)] max-w-md w-full mx-4 text-center">
          <div className="w-12 h-12 border-4 border-[#68A688]/20 border-t-[#68A688] rounded-full animate-spin mb-6" />
          <h3 className="font-outfit font-bold text-xl text-[#1E252B] mb-2 serif">Connecting to session…</h3>
          <p className="text-sm font-sans text-[#5C6B73]">Preparing secure video session credentials...</p>
        </div>
      </div>
    );
  }

  // 2. Initial Error State (API token retrieval failed)
  if (error) {
    const isWaitingForCoach = error === "Waiting for coach to start the meeting.";
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[9999]" style={backgroundStyle}>
        <div className="flex flex-col items-center justify-center p-8 max-w-md w-full mx-4 text-center bg-white border border-[#D2DBE3] rounded-[28px] shadow-[0_24px_50px_rgba(92,107,115,0.08)]">
          <div className="text-4xl mb-4 flex justify-center">
            {isWaitingForCoach ? (
              <div className="w-12 h-12 border-4 border-[#68A688]/20 border-t-[#68A688] rounded-full animate-spin" />
            ) : (
              <AlertTriangle size={48} className="text-[#FF8D69]" />
            )}
          </div>
          <h3 className="font-outfit font-bold text-xl text-[#1E252B] mb-2 serif">
            {isWaitingForCoach ? "Meeting Not Started Yet" : "Unable to Join Call"}
          </h3>
          <p className="text-sm font-sans text-[#5C6B73] leading-relaxed mb-6 font-sans">
            {error}
          </p>
          <button
            onClick={handleBack}
            className="bg-[#68A688] text-white rounded-[12px] py-2.5 px-5 font-outfit font-semibold text-sm transition-colors duration-150 hover:bg-[#589274]"
          >
            {role === "coach" ? "Return to Sessions" : "Return to Coaching"}
          </button>
        </div>
      </div>
    );
  }

  // 3. Render Session Video Call (if tokenDetails loaded successfully)
  if (tokenDetails) {
    return (
      <SessionVideoCall
        token={tokenDetails.token}
        serverUrl={tokenDetails.serverUrl}
        roomName={tokenDetails.roomName}
        role={role || ""}
        coachId={tokenDetails.coachId}
      />
    );
  }

  return null;
}
