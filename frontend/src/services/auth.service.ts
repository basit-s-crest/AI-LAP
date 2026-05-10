/**
 * auth.service.ts
 * All calls go to the Express backend at NEXT_PUBLIC_API_URL.
 * The interface (AuthSession, AuthUser) is unchanged so hooks/store need no edits.
 */

import api from "@/lib/api";
import type { AuthSession, AuthUser, LoginCredentials, RegisterPayload } from "@/types/auth";

// ─── Response shapes from the backend ────────────────────────────────────────

interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: string;       // "member" | "coach" — always present now
  avatar: string | null;
  isVerified?: boolean; // only on User, not Coach
  createdAt: string;
  updatedAt: string;
}

interface RegisterResponse {
  message: string;
  userId: string;
}

interface LoginResponse {
  message: string;
  token: string;
  user: BackendUser;  // both /api/auth/login and /api/coach/login return "user" key
}

interface VerifyOtpResponse {
  message: string;
  token: string;
  user: BackendUser;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAuthUser(u: BackendUser): AuthUser {
  const [firstName = "", ...rest] = (u.name ?? "").trim().split(" ");
  const lastName = rest.join(" ");
  return {
    id: u.id,
    email: u.email,
    firstName,
    lastName,
    // Backend sends explicit "coach" or "member"/"user" — map to frontend Role
    role: u.role === "coach" ? "coach" : "user",
  };
}

function buildSession(token: string, user: BackendUser): AuthSession {
  return {
    token,
    user: toAuthUser(user),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const authService = {
  /**
   * Step 1 of member signup: creates the account and triggers the OTP email.
   * Returns { userId } so the caller can redirect to /verify?userId=...
   */
  async register(payload: RegisterPayload): Promise<{ userId: string }> {
    const name = `${payload.firstName} ${payload.lastName}`.trim();
    const { data } = await api.post<RegisterResponse>("/api/auth/register", {
      name,
      email: payload.email,
      password: payload.password,
    });
    return { userId: data.userId };
  },

  /**
   * Coach signup — hits the separate coach endpoint.
   * No email verification needed; redirects straight to login.
   */
  async registerCoach(payload: RegisterPayload): Promise<void> {
    const name = `${payload.firstName} ${payload.lastName}`.trim();
    await api.post("/api/coach/register", {
      name,
      email: payload.email,
      password: payload.password,
      speciality: payload.specialties ?? null,
    });
  },

  /**
   * Step 2 of signup: submits the OTP and returns a full session.
   */
  async verifyOtp(userId: string, otp: string): Promise<AuthSession> {
    const { data } = await api.post<VerifyOtpResponse>("/api/auth/verify-otp", {
      userId,
      otp,
    });
    return buildSession(data.token, data.user);
  },

  /**
   * Requests a fresh OTP for the given userId.
   */
  async resendOtp(userId: string): Promise<void> {
    await api.post("/api/auth/resend-otp", { userId });
  },

  /**
   * Member login — returns a full session on success.
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const { data } = await api.post<LoginResponse>("/api/auth/login", credentials);
    return buildSession(data.token, data.user);
  },

  /**
   * Coach login — hits the separate coach endpoint.
   */
  async loginCoach(credentials: LoginCredentials): Promise<AuthSession> {
    const { data } = await api.post<LoginResponse>("/api/coach/login", credentials);
    return buildSession(data.token, data.user);
  },

  async logout(): Promise<void> {
    // JWT is stateless — just clear client-side storage (handled by authSlice)
  },
};
