import type { Coach } from "@/types/coach";
import coaches from "@/mock/coaches.json";

export const coachService = {
  async list(): Promise<Coach[]> {
    return coaches as Coach[];
  },

  async getById(id: number): Promise<Coach | undefined> {
    return (coaches as Coach[]).find((c) => c.id === id);
  },
};
