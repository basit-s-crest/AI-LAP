export type SessionNoteStatus = "draft" | "saved";

export type SessionNoteType =
  | "Weekly Check-in"
  | "Initial Session"
  | "Follow-up"
  | "Crisis";

export type TranscriptLine = {
  speaker: 'member' | 'coach'
  text: string
  timestamp: string   // ISO string — use new Date().toISOString()
  isFinal: boolean
}

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

export interface AiSessionNoteDTO {
  id: string;
  sessionId?: string | null;
  memberId: string;
  transcript: TranscriptLine[];
  summary: string;
  keyThemes: string[];
  memberSentiment: string;
  coachObservations: string;
  riskFlag: boolean;
  riskNotes: string;
  recommendedFollowUp: string;
  createdAt: string;
}

export interface CreateAiSessionNotePayload {
  memberId: string;
  sessionId?: string | null;
  transcript: TranscriptLine[];
}

