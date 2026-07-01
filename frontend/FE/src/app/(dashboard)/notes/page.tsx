"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useAppSelector } from "@/hooks/redux";
import api from "@/lib/api";
import { sessionNoteService } from "@/services/sessionNote.service";
import type { SessionNoteDTO, SessionNoteType } from "@/types/sessionNote";
import ChangeInsightsPanel from "@/components/session/ChangeInsightsPanel";
import { changeInsightService } from "@/services/changeInsight.service";

const SESSION_TYPE_OPTIONS: { value: SessionNoteType; label: string }[] = [
  { value: "Weekly Check-in", label: "Weekly Check-in" },
  { value: "Initial Session", label: "Initial Session" },
  { value: "Follow-up", label: "Follow-up" },
  { value: "Crisis", label: "Crisis" },
];

interface CoachMemberOption {
  id: string;
  name: string;
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const emptyForm = {
  memberId: "",
  sessionType: "Weekly Check-in" as SessionNoteType,
  notes: "",
  nextSessionGoal: "",
};

export default function NotesPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("sessionId");
  const coachId = useAppSelector((s) => s.auth.user?.id);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [activeRightTab, setActiveRightTab] = useState<"note" | "insights">("note");
  const [insight, setInsight] = useState<any>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [insightStatusMessage, setInsightStatusMessage] = useState<string | null>(null);

  const { data: members = [] } = useQuery<CoachMemberOption[]>({
    queryKey: ["coach", "members"],
    queryFn: async () => {
      const { data } = await api.get<{ members: CoachMemberOption[] }>(
        "/api/coach/members"
      );
      return data.members;
    },
    enabled: !!coachId,
  });

  const memberOptions = members.map((m) => ({ value: m.id, label: m.name }));

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["session-notes", coachId],
    queryFn: () => sessionNoteService.listForCoach(coachId!),
    enabled: !!coachId,
  });

  useEffect(() => {
    if (!form.memberId && memberOptions.length > 0) {
      setForm((prev) => ({ ...prev, memberId: memberOptions[0].value }));
    }
  }, [memberOptions, form.memberId]);

  const resetForm = useCallback(() => {
    setSelectedNoteId(null);
    setSelectedSessionId(null);
    setActiveRightTab("note");
    setInsight(null);
    setInsightStatusMessage(null);
    setForm({
      ...emptyForm,
      memberId: memberOptions[0]?.value ?? "",
    });
  }, [memberOptions]);

  const loadNoteIntoForm = useCallback((note: SessionNoteDTO) => {
    setSelectedNoteId(note.id);
    setSelectedSessionId(note.sessionId);
    setActiveRightTab("note");
    setInsight(null);
    setInsightStatusMessage(null);
    setForm({
      memberId: note.memberId,
      sessionType: (note.sessionType || "Weekly Check-in") as SessionNoteType,
      notes: note.summary || note.notes || "",
      nextSessionGoal: note.recommendedFollowUp || note.nextSessionGoal || "",
    });
  }, []);

  const loadChangeInsights = useCallback(async (sessId: string) => {
    setIsInsightLoading(true);
    setInsightStatusMessage(null);
    try {
      const res = await changeInsightService.compare(sessId);
      if (res.status === "success" && res.insight) {
        setInsight(res.insight);
      } else {
        setInsight(null);
        setInsightStatusMessage(res.message || "Comparison could not be completed.");
      }
    } catch (err: any) {
      console.error("[NotesPage] Failed to load comparison:", err);
      setInsight(null);
      setInsightStatusMessage("An error occurred while generating change insights.");
    } finally {
      setIsInsightLoading(false);
    }
  }, []);

  const handleTabChange = (tab: "note" | "insights") => {
    setActiveRightTab(tab);
    if (tab === "insights" && selectedSessionId && !insight && !isInsightLoading) {
      loadChangeInsights(selectedSessionId);
    }
  };

  useEffect(() => {
    if (sessionIdParam) {
      const matched = notes.find((n) => n.sessionId === sessionIdParam);
      if (matched) {
        loadNoteIntoForm(matched);
      } else {
        const fetchNoteBySessionId = async () => {
          try {
            const res = await sessionNoteService.getSessionNote(sessionIdParam);
            if (res.exists && res.note) {
              loadNoteIntoForm(res.note);
            }
          } catch (err) {
            console.error("[NotesPage] Failed to fetch session note:", err);
          }
        };
        fetchNoteBySessionId();
      }
    }
  }, [sessionIdParam, notes, loadNoteIntoForm]);

  const saveNote = async (status: "draft" | "saved") => {
    if (!coachId) {
      toast.error("You must be logged in as a coach.");
      return;
    }
    if (!form.memberId) {
      toast.error("Please select a client.");
      return;
    }

    setSaving(true);
    try {
      if (selectedSessionId) {
        // Session-based note versions
        await sessionNoteService.saveSessionNote(selectedSessionId, {
          summary: form.notes,
          recommendedFollowUp: form.nextSessionGoal,
          status: status === "draft" ? "DRAFT" : "FINAL",
          sessionType: form.sessionType,
        });
      } else {
        // Manual notes
        if (selectedNoteId) {
          await sessionNoteService.update(selectedNoteId, {
            notes: form.notes,
            nextSessionGoal: form.nextSessionGoal,
            status: status === "draft" ? "draft" : "saved",
            sessionType: form.sessionType,
          });
        } else {
          await sessionNoteService.create({
            memberId: form.memberId,
            sessionType: form.sessionType,
            notes: form.notes,
            nextSessionGoal: form.nextSessionGoal,
            status: status === "draft" ? "draft" : "saved",
          });
        }
      }
      toast.success(status === "draft" ? "Draft saved" : "Note saved & closed");
      await queryClient.invalidateQueries({ queryKey: ["session-notes", coachId] });
      if (status === "saved") resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Session Notes">
      <div className="grid anim-up grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <TableWrap>
          <TableToolbar title="Recent Notes">
            <Button size="sm" type="button" onClick={resetForm}>
              + New Note
            </Button>
          </TableToolbar>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Client", "Session Date", "Type"].map((h) => (
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
              {notesLoading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="border-b border-line px-[22px] py-[13px] text-sm text-dim text-ink"
                  >
                    Loading notes…
                  </td>
                </tr>
              ) : notes.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="border-b border-line px-[22px] py-[13px] text-sm text-dim text-ink"
                  >
                    No session notes yet.
                  </td>
                </tr>
              ) : (
                notes.map((n) => (
                  <tr
                    key={n.id}
                    className={cn(
                      "group cursor-pointer text-ink",
                      selectedNoteId === n.id && "bg-sage-soft"
                    )}
                    onClick={() => loadNoteIntoForm(n)}
                  >
                    <td className="border-b border-line px-[22px] py-[13px] font-semibold group-hover:bg-[var(--bg-surface-2)]">
                      {n.clientName}
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] font-mono text-xs text-mid group-hover:bg-[var(--bg-surface-2)]">
                      {formatSessionDate(n.updatedAt)}
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] text-sm text-mid group-hover:bg-[var(--bg-surface-2)]">
                      {n.sessionType || (n.sessionId ? "Video Call Note" : "Manual Note")}
                      {(n.status === "draft" || n.status === "DRAFT") && (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-dim">
                          (draft)
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
        <Card>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-line">
            <h3 className="serif text-lg font-semibold text-ink">Session Workspace</h3>
            <div className="flex gap-1.5 bg-[#F1F6FC] p-1 rounded-xl border border-[#D2DBE3]">
              <button
                type="button"
                onClick={() => handleTabChange("note")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold font-outfit transition-all",
                  activeRightTab === "note"
                    ? "bg-white text-[#4E8C58] shadow-sm font-bold border border-[#D2DBE3]"
                    : "text-[#5C6B73] hover:text-[#1E252B]"
                )}
              >
                Session Note
              </button>
              <button
                type="button"
                disabled={!selectedSessionId}
                onClick={() => handleTabChange("insights")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold font-outfit transition-all",
                  activeRightTab === "insights"
                    ? "bg-white text-[#4E8C58] shadow-sm font-bold border border-[#D2DBE3]"
                    : "text-[#5C6B73] hover:text-[#1E252B]",
                  !selectedSessionId && "opacity-40 cursor-not-allowed"
                )}
                title={!selectedSessionId ? "Comparison requires a session-based note" : ""}
              >
                Change Detection
              </button>
            </div>
          </div>

          {activeRightTab === "note" ? (
            <>
              <div className="mb-4">
                <Label>Client</Label>
                <Select
                  options={memberOptions}
                  value={form.memberId}
                  disabled={!!selectedNoteId}
                  onChange={(v) => setForm((prev) => ({ ...prev, memberId: v }))}
                />
              </div>
              <div className="mb-4">
                <Label>Session Type</Label>
                <Select
                  options={SESSION_TYPE_OPTIONS}
                  value={form.sessionType}
                  disabled={!!selectedSessionId}
                  onChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      sessionType: v as SessionNoteType,
                    }))
                  }
                />
              </div>
              <div className="mb-4">
                <Label>Notes</Label>
                <Textarea
                  rows={5}
                  placeholder="Session observations, progress, action items..."
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <div className="mb-4">
                <Label>Next Session Goal</Label>
                <Textarea
                  rows={2}
                  placeholder="What to focus on next time..."
                  value={form.nextSessionGoal}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nextSessionGoal: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  disabled={saving}
                  onClick={() => saveNote("draft")}
                >
                  Save Draft
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => saveNote("saved")}
                >
                  Save & Close
                </Button>
              </div>
            </>
          ) : (
            <ChangeInsightsPanel
              insight={insight}
              isLoading={isInsightLoading}
              statusMessage={insightStatusMessage}
            />
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
