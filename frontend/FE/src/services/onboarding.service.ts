import api from "@/lib/api";

export interface OnboardingPayload {
  age?: string;
  identity?: string;
  gender?: string;
  orient?: string;
  phqAnswers?: number[];
  gadAnswers?: number[];
}

export interface OnboardingAssessment {
  id: string;
  userId: string;
  age: string | null;
  identity: string | null;
  gender: string | null;
  orient: string | null;
  phqAnswers: number[];
  phqScore: number;
  gadAnswers: number[];
  gadScore: number;
  createdAt: string;
  updatedAt: string;
}

export const onboardingService = {
  async submit(payload: OnboardingPayload): Promise<void> {
    await api.post("/api/onboarding", payload);
  },

  async getMyAssessment(): Promise<OnboardingAssessment | null> {
    const { data } = await api.get<{ assessment: OnboardingAssessment | null }>("/api/onboarding/me");
    return data.assessment;
  },
};
