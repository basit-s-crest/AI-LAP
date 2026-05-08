export type CoachAvailability = "available" | "busy" | "offline";

export interface Coach {
  id: number;
  name: string;
  emoji: string;
  bg: string;
  avail: CoachAvailability;
  rating: number | null;
  sessions: number;
  clients: number;
  spec: string;
  org: string;
  status?: string;
}
