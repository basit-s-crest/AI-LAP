export type GroupStatus = "active" | "paused";

export interface CommunityGroup {
  id: number;
  name: string;
  emoji: string;
  members: number;
  posts: number;
  joined: boolean;
  color: string;
  desc: string;
  tags: string[];
  mod: string;
  status: GroupStatus;
}

export interface GroupPost {
  id: number;
  author: string;
  emoji: string;
  time: string;
  body: string;
  replies: number;
}
