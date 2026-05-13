import { Building2, HeartHandshake, ShieldCheck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/types/role";

export type AuthRoleOption = {
  role: Role;
  label: string;
  registerTitle: string;
  registerSubtitle: string;
  loginEmail: string;
  description: string;
  icon: LucideIcon;
};

export const AUTH_ROLE_OPTIONS: AuthRoleOption[] = [
  {
    role: "user",
    label: "Member",
    registerTitle: "Create Member Account",
    registerSubtitle: "Begin your wellness journey",
    loginEmail: "amara@azadihealth.com",
    description: "Access care, community groups, mood tools, resources, and your wellness dashboard.",
    icon: UserRound,
  },
  {
    role: "organization",
    label: "Organization",
    registerTitle: "Register Organization",
    registerSubtitle: "Bring culturally responsive support to your community",
    loginEmail: "chen@stateU.edu",
    description: "Manage members, outcomes, coaches, program access, and organization settings.",
    icon: Building2,
  },
  {
    role: "coach",
    label: "Coach",
    registerTitle: "Register Coach Profile",
    registerSubtitle: "Support members with trusted care",
    loginEmail: "osei@azadihealth.com",
    description: "Manage sessions, clients, availability, notes, and coaching conversations.",
    icon: HeartHandshake,
  },
  {
    role: "superadmin",
    label: "Superadmin",
    registerTitle: "Create Superadmin Account",
    registerSubtitle: "Administer the platform securely",
    loginEmail: "admin@azadihealth.com",
    description: "Oversee users, organizations, moderation, platform activity, and access controls.",
    icon: ShieldCheck,
  },
];

export const DEFAULT_AUTH_ROLE: Role = "user";

export function getAuthRoleOption(role: Role): AuthRoleOption {
  return AUTH_ROLE_OPTIONS.find((option) => option.role === role) ?? AUTH_ROLE_OPTIONS[0];
}

export function parseAuthRole(value: string | null | undefined): Role {
  const match = AUTH_ROLE_OPTIONS.find((option) => option.role === value);
  return match?.role ?? DEFAULT_AUTH_ROLE;
}

