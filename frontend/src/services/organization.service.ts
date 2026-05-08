import type { Organization } from "@/types/organization";
import organizations from "@/mock/organizations.json";

export const organizationService = {
  async list(): Promise<Organization[]> {
    return organizations as Organization[];
  },

  async getById(id: number): Promise<Organization | undefined> {
    return (organizations as Organization[]).find((o) => o.id === id);
  },
};
