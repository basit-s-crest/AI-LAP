"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { StatsCard } from "@/components/cards/StatsCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";

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

  const startOrJoinVideo = async (sessionId: string) => {
    setRowLoading((prev) => ({ ...prev, [sessionId]: true }));
    try {
      await api.post(`/api/sessions/${sessionId}/livekit/start`);
      router.push(`/coaching/sessions/${sessionId}/call`);
    } catch (err: any) {
      alert(err.message || "Failed to start call");
      setRowLoading((prev) => ({ ...prev, [sessionId]: false }));
    }
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
                              disabled={rowLoading[s.id]}
                              onClick={() => startOrJoinVideo(s.id)}
                            >
                              {rowLoading[s.id] ? "Joining…" : "Join Call"}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="xs"
                              type="button"
                              disabled={rowLoading[s.id]}
                              onClick={() => startOrJoinVideo(s.id)}
                            >
                              {rowLoading[s.id] ? "Starting…" : "Start Call"}
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
    </DashboardLayout>
  );
}
