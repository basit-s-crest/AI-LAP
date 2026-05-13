export type SessionStatus = "upcoming" | "completed" | "pending" | "open" | "confirmed";

export interface CoachingSession {
  id: string;
  date: string;
  client: string;
  type: string;
  duration: string;
  status: SessionStatus;
}
