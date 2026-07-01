export type SessionNoteStatus = "DRAFT" | "FINAL" | "draft" | "saved";

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
  sessionId: string | null;
  coachId: string;
  memberId: string;
  clientName: string;
  aiSessionNoteId: string | null;
  status: SessionNoteStatus;
  sessionType?: SessionNoteType;
  createdAt: string;
  updatedAt: string;
  version: number | null;
  // Structured versioned fields
  summary: string;
  keyThemes: string[];
  memberSentiment: string;
  coachObservations: string;
  riskFlag: boolean;
  riskNotes: string;
  recommendedFollowUp: string;
  emotionTimeline?: any;
  emotionCounts?: any;
  // Legacy / Manual fields
  notes?: string;
  nextSessionGoal?: string;
}

export interface SessionNoteVersionDTO {
  id: string;
  noteId: string;
  version: number;
  summary: string;
  keyThemes: string[];
  memberSentiment: string;
  coachObservations: string;
  riskFlag: boolean;
  riskNotes: string;
  recommendedFollowUp: string;
  createdById: string;
  createdAt: string;
  emotionTimeline?: any;
  emotionCounts?: any;
}

export interface SaveSessionNotePayload {
  // New fields
  summary?: string;
  keyThemes?: string[];
  memberSentiment?: string;
  coachObservations?: string;
  riskFlag?: boolean;
  riskNotes?: string;
  recommendedFollowUp?: string;
  status: SessionNoteStatus;
  aiSessionNoteId?: string;
  sessionType?: SessionNoteType;
  emotionTimeline?: any;
  emotionCounts?: any;
  // Old fields for manual saves
  notes?: string;
  nextSessionGoal?: string;
}

export interface CreateSessionNotePayload {
  memberId: string;
  sessionType?: SessionNoteType;
  notes?: string;
  nextSessionGoal?: string;
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
  emotionTimeline?: any;
  emotionCounts?: any;
}

export interface CreateAiSessionNotePayload {
  memberId: string;
  sessionId?: string | null;
  transcript: TranscriptLine[];
  emotionTimeline?: any;
  emotionCounts?: any;
}
