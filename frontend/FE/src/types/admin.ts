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
}

export interface AdminGroup {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  color: string;
  tags: string[];
  mod: string | null;
  status: string;
  memberCount: number;
  postCount: number;
  createdAt: string;
}
