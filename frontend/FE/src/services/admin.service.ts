import type { CommunityGroup } from "@/types/group";
import activity from "@/mock/activity.json";
import api from "@/lib/api";
import type { AdminGroup } from "@/types/admin";

export interface ActivityItem {
  icon: string;
  bg: string;
  html: string;
  time: string;
  type: string;
}

export const adminService = {
  async getGroups(): Promise<CommunityGroup[]> {
    const { data } = await api.get<AdminGroup[]>("/api/admin/groups");
    return data.map((group) => ({
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      members: group.memberCount,
      posts: group.postCount,
      joined: false,
      color: group.color,
      desc: group.description ?? "",
      tags: group.tags,
      mod: group.mod ?? "",
      status: group.status as CommunityGroup["status"],
    }));
  },

  async getActivity(): Promise<ActivityItem[]> {
    return activity as ActivityItem[];
  },
};
