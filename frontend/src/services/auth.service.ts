import type { AuthSession, AuthUser, LoginCredentials, RegisterPayload } from "@/types/auth";
import type { Role } from "@/types/role";
import authUsers from "@/mock/auth-users.json";

interface MockAuthRecord {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  organizationId?: string;
  avatarEmoji?: string;
}

const records = authUsers as MockAuthRecord[];

function buildToken(userId: string): string {
  return `mock_${userId}_${Date.now().toString(36)}`;
}

function toAuthUser(r: MockAuthRecord): AuthUser {
  return {
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    role: r.role,
    organizationId: r.organizationId,
    avatarEmoji: r.avatarEmoji,
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const found = records.find(
      (r) =>
        r.email.toLowerCase() === credentials.email.trim().toLowerCase() &&
        r.password === credentials.password
    );
    if (!found) {
      throw new Error("Invalid email or password");
    }
    const user = toAuthUser(found);
    return {
      token: buildToken(user.id),
      user,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  async register(payload: RegisterPayload): Promise<AuthSession> {
    const user: AuthUser = {
      id: `u-${Date.now()}`,
      email: payload.email.trim().toLowerCase(),
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role ?? "user",
      organizationId: payload.role === "organization" ? `org-${Date.now()}` : undefined,
      avatarEmoji:
        payload.role === "coach"
          ? "CO"
          : payload.role === "organization"
            ? "OR"
            : payload.role === "superadmin"
              ? "SA"
              : "ME",
    };
    return {
      token: buildToken(user.id),
      user,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  /** Demo: switch role without password — persists via Redux + cookie */
  async switchRole(role: Role, baseEmail?: string): Promise<AuthSession> {
    const match =
      records.find((r) => r.role === role) ??
      records.find((r) => r.email === baseEmail) ??
      records[0];
    const user: AuthUser = {
      ...toAuthUser(match),
      role,
    };
    return {
      token: buildToken(user.id),
      user,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  async logout(): Promise<void> {
    return;
  },
};
