import React, { useState, useEffect } from "react";
import { sessionNoteService } from "@/services/sessionNote.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

interface SessionNoteEditorProps {
  sessionId: string;
  memberId: string;
  clientName: string;
  sessionType?: string;
  initialNotes?: string;
  initialNextSessionGoal?: string;
  aiSessionNoteId?: string | null;
  emotionTimeline?: any;
  emotionCounts?: any;
  onCancel: () => void;
}

export default function SessionNoteEditor({
  sessionId,
  memberId,
  clientName,
  sessionType = "Weekly Check-in",
  initialNotes = "",
  initialNextSessionGoal = "",
  aiSessionNoteId,
  emotionTimeline: initialEmotionTimeline = null,
  emotionCounts: initialEmotionCounts = null,
  onCancel,
}: SessionNoteEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [nextSessionGoal, setNextSessionGoal] = useState(initialNextSessionGoal);
  const [emotionTimeline, setEmotionTimeline] = useState<any>(initialEmotionTimeline);
  const [emotionCounts, setEmotionCounts] = useState<any>(initialEmotionCounts);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingNoteId, setExistingNoteId] = useState<string | null>(null);

  useEffect(() => {
    const loadExistingNote = async () => {
      try {
        setIsLoading(true);
        const res = await sessionNoteService.getSessionNote(sessionId);
        if (res.exists && res.note) {
          setExistingNoteId(res.note.id);
          // If notes have already been edited/saved, load them
          setNotes(res.note.summary || "");
          setNextSessionGoal(res.note.recommendedFollowUp || "");
          setEmotionTimeline(res.note.emotionTimeline || null);
          setEmotionCounts(res.note.emotionCounts || null);
        } else if (res.prefillData) {
          setEmotionTimeline(res.prefillData.emotionTimeline || null);
          setEmotionCounts(res.prefillData.emotionCounts || null);
        }
      } catch (err) {
        console.error("[SessionNoteEditor] Failed to check existing note:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingNote();
  }, [sessionId]);

  const handleSave = async (status: "draft" | "saved") => {
    setIsSaving(true);
    try {
      await sessionNoteService.saveSessionNote(sessionId, {
        summary: notes,
        recommendedFollowUp: nextSessionGoal,
        status: status === "draft" ? "DRAFT" : "FINAL",
        aiSessionNoteId: aiSessionNoteId || undefined,
        sessionType: sessionType as any,
        emotionTimeline,
        emotionCounts,
      });

      toast.success(status === "draft" ? "Draft saved successfully!" : "Note saved & finalized!");
      onCancel(); // return back to AI tabs view after saving
    } catch (err: any) {
      console.error("[SessionNoteEditor] Save failed:", err);
      toast.error(err.message || "Failed to save session note.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col space-y-4 p-5 animate-pulse bg-white rounded-2xl border border-[#D2DBE3] h-full justify-center">
        <div className="h-6 w-1/3 bg-[#F1F6FC] rounded-lg self-center" />
        <div className="h-4 w-full bg-[#F1F6FC] rounded-lg" />
        <div className="h-4 w-5/6 bg-[#F1F6FC] rounded-lg" />
        <div className="h-4 w-4/6 bg-[#F1F6FC] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full bg-white rounded-2xl border border-[#D2DBE3] overflow-hidden shadow-sm h-full max-h-[700px]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#68A688] to-[#4E8C58] p-4 text-white flex justify-between items-center shrink-0">
        <div>
          <h4 className="font-outfit font-bold text-md tracking-wide">
            {existingNoteId ? "EDIT SESSION NOTE" : "CREATE SESSION NOTE"}
          </h4>
          <p className="text-[11px] opacity-90 font-sans mt-0.5">
            Coach Clinical Observations & Planning
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs bg-white/20 hover:bg-white/30 text-white font-outfit px-2.5 py-1 rounded-full transition-colors"
        >
          ✕ Cancel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Client Field */}
        <div>
          <Label>Client</Label>
          <input
            type="text"
            value={clientName}
            disabled
            className="w-full text-xs font-semibold p-2 rounded-lg border border-[#D2DBE3] bg-[#F1F6FC] text-[#5C6B73] cursor-not-allowed"
          />
        </div>

        {/* Session Type Field */}
        <div>
          <Label>Session Type</Label>
          <input
            type="text"
            value={sessionType}
            disabled
            className="w-full text-xs font-semibold p-2 rounded-lg border border-[#D2DBE3] bg-[#F1F6FC] text-[#5C6B73] cursor-not-allowed"
          />
        </div>

        {/* Notes Field */}
        <div>
          <Label>Notes</Label>
          <Textarea
            rows={8}
            placeholder="Session observations, progress, action items..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-xs leading-relaxed"
          />
        </div>

        {/* Next Session Goal Field */}
        <div>
          <Label>Next Session Goal</Label>
          <Textarea
            rows={3}
            placeholder="What to focus on next time..."
            value={nextSessionGoal}
            onChange={(e) => setNextSessionGoal(e.target.value)}
            className="text-xs leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-[#D2DBE3] shrink-0">
          <Button
            variant="ghost"
            type="button"
            disabled={isSaving}
            onClick={() => handleSave("draft")}
            className="flex-1"
          >
            Save Draft
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave("saved")}
            className="flex-1"
          >
            Save & Close
          </Button>
        </div>
      </div>
    </div>
  );
}
