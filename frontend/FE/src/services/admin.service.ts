import type { CommunityGroup } from "@/types/group";
import api from "@/lib/api";
import type { AdminGroup } from "@/types/admin";

export interface ActivityItem {
  id?: string;
  icon: string;
  bg: string;
  html: string;
  time: string;
  type: string;
}

export interface AdminActivityApiRow {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actorName: string | null;
}

export interface MoodDistributionApi {
  great: number;
  good: number;
  okay: number;
  low: number;
  struggling: number;
}

export interface AdminOverviewStats {
  totalUsers: number;
  activeCoaches: number;
  pendingUsers: number;
  totalSessions: number;
}

const ACTIVITY_VISUALS: Record<string, { icon: string; bg: string }> = {
  alert: { icon: "👤", bg: "#D4EDD7" },
  moderation: { icon: "💬", bg: "#D4E8F5" },
  join: { icon: "🧑‍🤝‍🧑", bg: "#F5E6C8" },
  session: { icon: "📅", bg: "#D4EDD7" },
  org: { icon: "🏢", bg: "#F5E6C8" },
  admin: { icon: "🆕", bg: "#D4E8F5" },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function mapActivityRow(row: AdminActivityApiRow): ActivityItem {
  const v = ACTIVITY_VISUALS[row.type] ?? ACTIVITY_VISUALS.admin;
  const actor = row.actorName?.trim();
  const msg = escapeHtml(row.message);
  const html = actor
    ? `<strong>${escapeHtml(actor)}</strong> ${msg}`
    : msg;
  return {
    id: row.id,
    icon: v.icon,
    bg: v.bg,
    html,
    time: formatTimeAgo(row.createdAt),
    type: row.type,
  };
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
    const { data } = await api.get<AdminActivityApiRow[]>("/api/admin/activity");
    return Array.isArray(data) ? data.map(mapActivityRow) : [];
  },

  async getMoodDistribution(): Promise<MoodDistributionApi> {
    const { data } = await api.get<MoodDistributionApi>("/api/admin/mood-distribution");
    return {
      great: Number(data?.great) || 0,
      good: Number(data?.good) || 0,
      okay: Number(data?.okay) || 0,
      low: Number(data?.low) || 0,
      struggling: Number(data?.struggling) || 0,
    };
  },

  async getOverviewStats(): Promise<AdminOverviewStats> {
    const { data } = await api.get<AdminOverviewStats>("/api/admin/overview-stats");
    return {
      totalUsers: Number(data?.totalUsers) || 0,
      activeCoaches: Number(data?.activeCoaches) || 0,
      pendingUsers: Number(data?.pendingUsers) || 0,
      totalSessions: Number(data?.totalSessions) || 0,
    };
  },
};
