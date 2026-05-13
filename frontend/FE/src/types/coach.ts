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

export interface CoachPublicDTO {
  id: string;           // CUID string from DB (not a number)
  name: string;
  email: string;
  avatar: string | null;   // emoji string
  bio: string | null;      // org affiliation
  speciality: string | null;
  isActive: boolean;
}
