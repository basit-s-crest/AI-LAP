import api from "@/lib/api";

export interface PlatformSettings {
  id: string;
  brandTitle: string;
  brandTagline: string;
  logoUrl: string | null;
  loaderUrl: string | null;
  primaryColor: string;
  supportEmail: string;
  maxMembersPerCoach: number;
  sessionDurationDefault: number;
  sessionDurationMax: number;
  sessionDurationMin: number;
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
  createdAt: string;
  updatedAt: string;
  emailFrom?: string;
}

export const platformSettingsService = {
  get(): Promise<PlatformSettings> {
    return api.get<PlatformSettings>("/api/admin/settings").then((r) => r.data);
  },
  patch(payload: Partial<PlatformSettings>) {
    return api.patch<PlatformSettings>("/api/admin/settings", payload).then((r) => r.data);
  },
  uploadLogo(base64: string) {
    return api
      .post<{ url: string }>("/api/admin/settings/upload-logo", { base64 })
      .then((r) => r.data);
  },
  uploadLoader(base64: string) {
    return api
      .post<{ url: string }>("/api/admin/settings/upload-loader", { base64 })
      .then((r) => r.data);
  },
};

