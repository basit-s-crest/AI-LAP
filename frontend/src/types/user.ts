export type UserStatus = "active" | "flagged" | "inactive";

export interface PlatformUser {
  id: number;
  name: string;
  email: string;
  joined: string;
  groups: number;
  sessions: number;
  mood: number | null;
  status: UserStatus;
  tags: string[];
}
