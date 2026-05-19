"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  const coachId = useAppSelector((s) => s.auth.user?.id);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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
    setForm({
      ...emptyForm,
      memberId: memberOptions[0]?.value ?? "",
    });
  }, [memberOptions]);

  const loadNoteIntoForm = useCallback((note: SessionNoteDTO) => {
    setSelectedNoteId(note.id);
    setForm({
      memberId: note.memberId,
      sessionType: note.sessionType,
      notes: note.notes,
      nextSessionGoal: note.nextSessionGoal,
    });
  }, []);

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
      if (selectedNoteId) {
        await sessionNoteService.update(selectedNoteId, { ...form, status });
        toast.success(status === "draft" ? "Draft saved" : "Note saved & closed");
      } else {
        await sessionNoteService.create({ ...form, status });
        toast.success(status === "draft" ? "Draft created" : "Note saved & closed");
      }
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
      <div className="grid animate-fadeIn grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
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
                    className="border-b-[1.5px] border-line bg-[#EDE7DC] px-[22px] py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-dim"
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
                    className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-dim"
                  >
                    Loading notes…
                  </td>
                </tr>
              ) : notes.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-dim"
                  >
                    No session notes yet.
                  </td>
                </tr>
              ) : (
                notes.map((n) => (
                  <tr
                    key={n.id}
                    className={cn(
                      "group cursor-pointer",
                      selectedNoteId === n.id && "bg-sage-soft"
                    )}
                    onClick={() => loadNoteIntoForm(n)}
                  >
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-semibold group-hover:bg-[#EDE7DC]">
                      {n.clientName}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono text-xs text-mid group-hover:bg-[#EDE7DC]">
                      {formatSessionDate(n.sessionDate)}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-mid group-hover:bg-[#EDE7DC]">
                      {n.sessionType}
                      {n.status === "draft" && (
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
          <h3 className="mb-3 font-serif text-lg font-semibold">Session Note</h3>
          <div className="mb-4">
            <Label>Client</Label>
            <Select
              options={memberOptions}
              value={form.memberId}
              onChange={(v) => setForm((prev) => ({ ...prev, memberId: v }))}
            />
          </div>
          <div className="mb-4">
            <Label>Session Type</Label>
            <Select
              options={SESSION_TYPE_OPTIONS}
              value={form.sessionType}
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
        </Card>
      </div>
    </DashboardLayout>
  );
}
