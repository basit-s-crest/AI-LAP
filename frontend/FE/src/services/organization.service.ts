import type { Organization } from "@/types/organization";
import api from "@/lib/api";

/** Matches GET /api/admin/orgs list items */
interface AdminOrgListRow {
  id: string;
  name: string;
  type: string;
  plan: string;
  totalMembers: number;
  activeMembers: number;
  totalCoaches: number;
  monthlySpend: number;
  primaryContactEmail: string;
}

function formatMonthlySpend(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0/mo";
  if (n >= 1000) {
    const k = n / 1000;
    return `$${k >= 10 ? k.toFixed(0) : k.toFixed(1)}k/mo`;
  }
  return `$${Math.round(n)}/mo`;
}

function mapAdminOrgToOrganization(o: AdminOrgListRow): Organization {
  return {
    id: o.id,
    name: o.name,
    type: o.type,
    plan: o.plan,
    users: o.totalMembers,
    active: o.activeMembers,
    coaches: o.totalCoaches,
    spend: formatMonthlySpend(o.monthlySpend),
    contact: o.primaryContactEmail,
  };
}

export const organizationService = {
  async list(): Promise<Organization[]> {
    const { data } = await api.get<AdminOrgListRow[]>("/api/admin/orgs");
    return data.map(mapAdminOrgToOrganization);
  },

  async getById(id: string | number): Promise<Organization | undefined> {
    const rows = await this.list();
    return rows.find((o) => String(o.id) === String(id));
  },
};
