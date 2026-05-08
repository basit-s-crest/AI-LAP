import type { PlatformUser } from "@/types/user";
import users from "@/mock/users.json";

export const userService = {
  async list(): Promise<PlatformUser[]> {
    return users as PlatformUser[];
  },

  async getById(id: number): Promise<PlatformUser | undefined> {
    return (users as PlatformUser[]).find((u) => u.id === id);
  },
};
