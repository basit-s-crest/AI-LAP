import type { PlatformUser } from "@/types/user";
import api from "@/lib/api";
import type { AdminUser } from "@/types/admin";

function formatJoinedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toPlatformUser(user: AdminUser): PlatformUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    joined: formatJoinedDate(user.createdAt),
    groups: user.groupCount,
    sessions: user.messageCount,
    mood: null,
    status: user.isVerified ? "active" : "inactive",
    tags: [user.role, user.isVerified ? "verified" : "pending"],
  };
}

export const userService = {
  async list(): Promise<PlatformUser[]> {
    const { data } = await api.get<AdminUser[]>("/api/admin/users");
    return data.map(toPlatformUser);
  },

  async getById(id: string): Promise<PlatformUser | undefined> {
    const { data } = await api.get<AdminUser>(`/api/admin/users/${id}`);
    return toPlatformUser(data);
  },
};
