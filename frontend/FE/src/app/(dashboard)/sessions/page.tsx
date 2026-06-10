"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { StatsCard } from "@/components/cards/StatsCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";
import { LiveKitApiService } from "@/services/livekit.service";
import type { LiveKitTokenResponse } from "@/types/livekit";
import SessionVideoCall from "@/components/livekit/SessionVideoCall";

interface SessionRow {
  id: string;
  memberName: string;
  date: string;       // ISO string from API
  duration: number;
  type: string;
  status: string;
  livekitStartedAt?: string;
  livekitEndedAt?: string;
}

// ── Meeting Modal Overlay Component ──────────────────────────────────────────
function MeetingModal({
  sessionId,
  clientName,
  sessionTime,
  onClose,
}: {
  sessionId: string;
  clientName: string;
  sessionTime: string;
  onClose: () => void;
}) {
  const [tokenDetails, setTokenDetails] = useState<LiveKitTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchStarted = useRef(false);

  const [callTimer, setCallTimer] = useState<string | null>(null);
  const [participantInfo, setParticipantInfo] = useState<{ name: string; quality: string } | null>(null);

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
        setError(err.message || "Failed to establish a connection to the video room.");
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

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4">
      <div
        className="relative w-full max-w-[950px] bg-white rounded-[24px] p-6 flex flex-col animate-up overflow-hidden"
        style={{ boxShadow: "0 32px 64px rgba(0,0,0,0.35)" }}
      >
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between pb-4">
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
              className="flex items-center justify-center w-8 h-8 rounded-full border border-[#D2DBE3] text-[#5C6B73] hover:bg-[#F1F6FC] transition-colors font-semibold"
              title="Leave and Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body / Call Container */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#0F172A] border border-[#D2DBE3]">
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
              onParticipantUpdate={(name, quality) => setParticipantInfo({ name, quality })}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function CoachSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({});

  const [meetingSessionId, setMeetingSessionId] = useState<string | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingClientName, setMeetingClientName] = useState("");
  const [meetingSessionTime, setMeetingSessionTime] = useState("");

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    api
      .get<SessionRow[]>("/api/sessions/coach")
      .then(({ data }) => setSessions(data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  // Derived stats
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisWeek = sessions.filter((s) => new Date(s.date) >= weekStart).length;
  const thisMonth = sessions.filter((s) => new Date(s.date) >= monthStart).length;
  const totalHours = sessions.reduce((acc, s) => acc + s.duration / 60, 0);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const cancelTargetRow =
    cancelTargetId ? sessions.find((s) => s.id === cancelTargetId) : null;

  const performCancelSession = async () => {
    if (!cancelTargetId) return;
    setCancelLoading(true);
    setCancellingId(cancelTargetId);
    setActionLoading(true);
    try {
      await api.patch(`/api/sessions/${cancelTargetId}/cancel`);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === cancelTargetId ? { ...s, status: "cancelled" } : s
        )
      );
      setShowCancelConfirm(false);
      setCancelTargetId(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr?.response?.data?.message ?? "Failed to cancel");
    } finally {
      setCancelLoading(false);
      setActionLoading(false);
      setCancellingId(null);
    }
  };

  const handleReschedule = async () => {
    if (!reschedulingId || !newDate || !newTime) return;
    setActionLoading(true);
    try {
      const newScheduledAt = new Date(`${newDate}T${newTime}`).toISOString();
      await api.patch(`/api/sessions/${reschedulingId}/reschedule`, {
        newScheduledAt,
      });
      const { data } = await api.get<SessionRow[]>("/api/sessions/coach");
      setSessions(data);
      setReschedulingId(null);
      setNewDate("");
      setNewTime("");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr?.response?.data?.message ?? "Failed to reschedule");
    } finally {
      setActionLoading(false);
    }
  };

  const startOrJoinVideo = (session: SessionRow) => {
    setMeetingSessionId(session.id);
    setMeetingClientName(session.memberName);
    setMeetingSessionTime(formatDate(session.date));
    setMeetingOpen(true);
  };

  return (
    <DashboardLayout title="Sessions">
      <div className="anim-up">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard label="This Week" value={String(thisWeek)} sub="sessions" accent="teal" />
          <StatsCard label="This Month" value={String(thisMonth)} sub="sessions" accent="sage" />
          <StatsCard label="Total Hours" value={totalHours.toFixed(1)} sub="this month" accent="amber" />
        </div>
        <TableWrap>
          <TableToolbar title="Session History" />
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Date & Time", "Client", "Type", "Duration", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b-[1.5px] border-line bg-[var(--bg-surface-2)] px-[22px] py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid text-ink">
                    Loading sessions…
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid text-ink">
                    No sessions yet.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="group text-ink"
                    aria-busy={cancellingId === s.id}
                  >
                    <td className="border-b border-line px-[22px] py-[13px] font-mono text-sm group-hover:bg-[var(--bg-surface-2)]">
                      {formatDate(s.date)}
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] font-semibold group-hover:bg-[var(--bg-surface-2)]">
                      {s.memberName}
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] text-sm text-mid group-hover:bg-[var(--bg-surface-2)]">
                      {s.type}
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                      {s.duration} min
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                      <Badge
                        variant={
                          s.status === "upcoming"
                            ? "blue"
                            : s.status === "cancelled"
                              ? "red"
                              : s.status === "rescheduled"
                                ? "gold"
                                : "sage"
                        }
                      >
                        {s.status}
                      </Badge>
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                      {s.status === "completed" ? (
                        <Button variant="ghost" size="xs" type="button">
                          View Notes
                        </Button>
                      ) : s.status === "cancelled" ? (
                        <span className="text-xs text-dim">Cancelled</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {s.livekitStartedAt ? (
                            <Button
                              variant="primary"
                              size="xs"
                              type="button"
                              onClick={() => startOrJoinVideo(s)}
                            >
                              Join Call
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="xs"
                              type="button"
                              onClick={() => startOrJoinVideo(s)}
                            >
                              Start Call
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            type="button"
                            title="Open popup to pick a new date and time"
                            onClick={() => {
                              const d = new Date(s.date);
                              setReschedulingId(s.id);
                              setNewDate(d.toISOString().split("T")[0]);
                              setNewTime(d.toTimeString().slice(0, 5));
                            }}
                          >
                            Reschedule
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                              setCancelTargetId(s.id);
                              setShowCancelConfirm(true);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
        {portalReady &&
          reschedulingId &&
          createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="coach-reschedule-title"
            >
              <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl border border-line">
                <div className="mb-4 flex items-center justify-between">
                  <h3 id="coach-reschedule-title" className="serif text-lg font-semibold text-ink">
                    Reschedule Session
                  </h3>
                  <button
                    type="button"
                    onClick={() => setReschedulingId(null)}
                    className="text-dim hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-dim">
                      New Date
                    </label>
                    <input
                      type="date"
                      value={newDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full rounded-[9px] border-[1.5px] border-line bg-card px-3 py-2 text-[13.5px] text-ink outline-none focus:border-sage"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-dim">
                      New Time
                    </label>
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full rounded-[9px] border-[1.5px] border-line bg-card px-3 py-2 text-[13.5px] text-ink outline-none focus:border-sage"
                    />
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setReschedulingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleReschedule}
                    disabled={actionLoading || !newDate || !newTime}
                  >
                    {actionLoading ? "Saving…" : "Confirm Reschedule"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )}
        {portalReady &&
          showCancelConfirm &&
          cancelTargetId &&
          createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="coach-cancel-session-title"
            >
              <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl border border-line">
                <div className="mb-4 flex items-center justify-between">
                  <h3
                    id="coach-cancel-session-title"
                    className="serif text-lg font-semibold text-ink"
                  >
                    Cancel Session?
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelConfirm(false);
                      setCancelTargetId(null);
                    }}
                    className="text-dim hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-mid text-ink">
                  {cancelTargetRow?.memberName
                     ? `Are you sure you want to cancel the session with ${cancelTargetRow.memberName}?`
                     : "Are you sure you want to cancel this session?"}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setShowCancelConfirm(false);
                      setCancelTargetId(null);
                    }}
                  >
                    Keep Session
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    disabled={cancelLoading}
                    onClick={() => void performCancelSession()}
                  >
                    {cancelLoading ? "Cancelling…" : "Yes, Cancel"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
      {meetingOpen && meetingSessionId && (
        <MeetingModal
          sessionId={meetingSessionId}
          clientName={meetingClientName}
          sessionTime={meetingSessionTime}
          onClose={() => {
            setMeetingOpen(false);
            setMeetingSessionId(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
