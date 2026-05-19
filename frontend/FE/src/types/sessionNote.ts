export type SessionNoteStatus = "draft" | "saved";

export type SessionNoteType =
  | "Weekly Check-in"
  | "Initial Session"
  | "Follow-up"
  | "Crisis";

export interface SessionNoteDTO {
  id: string;
  coachId: string;
  memberId: string;
  clientName: string;
  sessionType: SessionNoteType;
  notes: string;
  nextSessionGoal: string;
  status: SessionNoteStatus;
  sessionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionNotePayload {
  memberId: string;
  sessionType: SessionNoteType;
  notes: string;
  nextSessionGoal: string;
  status: SessionNoteStatus;
}

export interface UpdateSessionNotePayload {
  memberId?: string;
  sessionType?: SessionNoteType;
  notes?: string;
  nextSessionGoal?: string;
  status?: SessionNoteStatus;
}
