export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  groupCount: number;
  messageCount: number;
  organizationId?: string | null;
}

export interface AdminCoach {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  speciality: string | null;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
  organizations: { id: string; name: string }[];
}

export interface AdminGroup {
  id: string;
  name: string;
  emoji: string;
  tags: string[];
  mod: string | null;
  status: string;
  memberCount: number;
  postCount: number;
  createdAt: string;
}