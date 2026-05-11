export type GroupStatus = "active" | "paused" | "archived";

export interface CommunityGroup {
  id: string;
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
  id: string;
  author: string;
  memberId: string;
  body: string;
  replyCount: number;
  supportCount: number;
  isFlagged: boolean;
  time: string;
}

export interface GroupDetail extends CommunityGroup {
  posts: GroupPost[];
}
