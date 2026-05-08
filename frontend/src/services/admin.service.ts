import type { CommunityGroup } from "@/types/group";
import groups from "@/mock/groups.json";
import activity from "@/mock/activity.json";

export interface ActivityItem {
  icon: string;
  bg: string;
  html: string;
  time: string;
  type: string;
}

export const adminService = {
  async getGroups(): Promise<CommunityGroup[]> {
    return JSON.parse(JSON.stringify(groups)) as CommunityGroup[];
  },

  async getActivity(): Promise<ActivityItem[]> {
    return activity as ActivityItem[];
  },
};
