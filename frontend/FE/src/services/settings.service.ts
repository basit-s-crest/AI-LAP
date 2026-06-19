import api from "@/lib/api";

export interface MemberProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  memberSince: string;
  stats: {
    dayStreak: number;
    checkIns: number;
    groups: number;
    sessions: number;
  };
  notifications: {
    notifyGroupActivity: boolean;
    notifySessionReminders: boolean;
    notifyDailyCheckin: boolean;
    notifyWeeklySummary: boolean;
  };
  assessments: {
    phq8: { score: number; max: number; label: string } | null;
    gad7: { score: number; max: number; label: string } | null;
  };
}

export interface CoachProfileResponse {
  coach: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
    bio: string | null;
    speciality: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  notifications: {
    notifySessionReminders: boolean;
    notifyNewClientAssigned: boolean;
    notifyMessageAlerts: boolean;
  };
}

export interface MemberConsentResponse {
  recording: boolean;
  ai_analysis: boolean;
}

export const settingsService = {
  getMemberProfile(): Promise<MemberProfileResponse> {
    return api.get<MemberProfileResponse>("/api/auth/profile").then((r) => r.data);
  },

  updateMemberProfile(payload: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    newPassword?: string;
    confirmPassword?: string;
  }) {
    return api
      .patch<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatar: string | null;
      }>("/api/auth/profile", payload)
      .then((r) => r.data);
  },

  updateMemberNotifications(
    payload: Partial<MemberProfileResponse["notifications"]>
  ) {
    return api.patch<MemberProfileResponse["notifications"]>("/api/auth/notifications", payload).then((r) => r.data);
  },

  getMemberConsent(): Promise<MemberConsentResponse> {
    return api.get<MemberConsentResponse>("/api/auth/consent").then((r) => r.data);
  },

  updateMemberConsent(payload: {
    consentType: "recording" | "ai_analysis";
    granted: boolean;
  }): Promise<{ message: string; consentType: string; granted: boolean }> {
    return api.post<{ message: string; consentType: string; granted: boolean }>("/api/auth/consent", payload).then((r) => r.data);
  },

  getCoachProfile(): Promise<CoachProfileResponse> {
    return api.get<CoachProfileResponse>("/api/coach/profile").then((r) => r.data);
  },

  updateCoachProfile(payload: {
    name?: string;
    bio?: string;
    speciality?: string;
    avatar?: string;
    newPassword?: string;
    confirmPassword?: string;
  }) {
    return api
      .patch<{ coach: CoachProfileResponse["coach"] }>("/api/coach/profile", payload)
      .then((r) => r.data);
  },

  updateCoachNotifications(
    payload: Partial<CoachProfileResponse["notifications"]>
  ) {
    return api.patch<CoachProfileResponse["notifications"]>("/api/coach/notifications", payload).then((r) => r.data);
  },
};

