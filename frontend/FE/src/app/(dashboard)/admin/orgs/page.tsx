"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BaseModal } from "@/components/modals/BaseModal";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "sonner";
import {
  useAdminOrgs,
  useAdminOrgStats,
  useCreateOrg,
  useUpdateOrg,
  type AdminOrg,
  type CreateOrgPayload,
} from "@/hooks/admin/useAdminOrgs";

// ── Stat card (matches existing admin page pattern) ───────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent: "sage" | "gold" | "blue" | "terra";
}) {
  const bar: Record<string, string> = {
    sage:  "from-[#4E8C58] to-[#7AB882]",
    gold:  "from-[#B8832A] to-[#D4A853]",
    blue:  "from-[#3A6E99] to-[#5A9EC8]",
    terra: "from-[#B35A38] to-[#D4824A]",
  };
  return (
    <div className="relative overflow-hidden rounded-[14px] border-[1.5px] border-line bg-card px-5 py-5">
      <div className={`absolute left-0 right-0 top-0 h-[3px] rounded-t-[14px] bg-gradient-to-r ${bar[accent]}`} />
      <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[1.2px] text-dim">{label}</p>
      <p className="font-serif text-[36px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-xs text-mid">{sub}</p>
    </div>
  );
}

// ── Plan badge helper ─────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  if (plan === "Enterprise") return <Badge variant="gold">Enterprise</Badge>;
  if (plan === "Pro")        return <Badge variant="blue">Pro</Badge>;
  return <Badge variant="dim">{plan}</Badge>;
}

// ── Shared select className (matches existing modal inputs) ───────────────────
const selectCls =
  "w-full rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-[#4E8C58] focus:shadow-[0_0_0_3px_#EBF5EC]";

const TYPE_OPTIONS = [
  { value: "University",     label: "University"     },
  { value: "Health Insurer", label: "Health Insurer" },
  { value: "Non-Profit",     label: "Non-Profit"     },
  { value: "Health System",  label: "Health System"  },
  { value: "Corporate",      label: "Corporate"      },
];

const PLAN_OPTIONS = [
  { value: "Starter",    label: "Starter"    },
  { value: "Pro",        label: "Pro"        },
  { value: "Enterprise", label: "Enterprise" },
];

// ── Blank form state ──────────────────────────────────────────────────────────
const BLANK: CreateOrgPayload = {
  name: "",
  type: "University",
  plan: "Starter",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPassword: "",
  monthlySpend: 0,
  domain: "",
};

export default function AdminOrgsPage() {
  const router = useRouter();
  const { data: orgs = [], isPending } = useAdminOrgs();
  const { data: stats } = useAdminOrgStats();
  const createOrg = useCreateOrg();
  const updateOrg = useUpdateOrg();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<AdminOrg | null>(null);

  // ── Add form state ──
  const [form, setForm] = useState<CreateOrgPayload>(BLANK);
  const [addError, setAddError] = useState("");

  // ── Edit form state ──
  const [editForm, setEditForm] = useState<Partial<AdminOrg>>({});
  const [editError, setEditError] = useState("");

  // ── Open edit modal ──
  const openEdit = (org: AdminOrg) => {
    setEditingOrg(org);
    setEditForm({
      name: org.name,
      type: org.type,
      plan: org.plan,
      primaryContactName: org.primaryContactName,
      monthlySpend: org.monthlySpend,
    });
    setEditError("");
  };

  // ── Submit create ──
  const handleCreate = () => {
    setAddError("");
    if (!form.name.trim() || !form.primaryContactEmail.trim() || !form.primaryContactPassword.trim()) {
      setAddError("Organization name, contact email and password are required.");
      return;
    }
    createOrg.mutate(form, {
      onSuccess: () => {
        setShowAddModal(false);
        setForm(BLANK);
        toast.success("Organization created");
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? "Failed to create organization";
        setAddError(msg);
      },
    });
  };

  // ── Submit edit ──
  const handleEdit = () => {
    if (!editingOrg) return;
    setEditError("");
    updateOrg.mutate(
      { id: editingOrg.id, ...editForm },
      {
        onSuccess: () => {
          setEditingOrg(null);
          toast.success("Organization updated");
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ?? "Failed to update organization";
          setEditError(msg);
        },
      }
    );
  };

  return (
    <DashboardLayout title="Client Organizations">
      <div className="animate-fadeIn">

        {/* ── Stat row ── */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Partners"
            value={stats?.totalPartners ?? "—"}
            sub="Active contracts"
            accent="sage"
          />
          <StatCard
            label="Total Members"
            value={stats ? stats.totalMembers.toLocaleString() : "—"}
            sub="Across all orgs"
            accent="gold"
          />
          <StatCard
            label="MRR"
            value={stats ? `$${(stats.totalMRR / 1000).toFixed(1)}k` : "—"}
            sub="Monthly recurring revenue"
            accent="blue"
          />
          <StatCard
            label="Active Coaches"
            value={stats?.totalCoaches ?? "—"}
            sub="Across all orgs"
            accent="terra"
          />
        </div>

        {/* ── Table ── */}
        <TableWrap>
          <TableToolbar title="Client Organizations">
            <Button
              size="sm"
              type="button"
              onClick={() => { setForm(BLANK); setAddError(""); setShowAddModal(true); }}
            >
              + Add Partner
            </Button>
          </TableToolbar>

          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Organization", "Type", "Plan", "Users", "Active Rate", "Coaches", "MRR", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="border-b-[1.5px] border-line bg-[#EDE7DC] px-[22px] py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={8} className="px-[22px] py-8 text-center text-sm text-mid">
                    Loading organizations…
                  </td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-[22px] py-10 text-center text-sm text-mid">
                    No organizations yet. Click <strong>+ Add Partner</strong> to onboard your first client.
                  </td>
                </tr>
              ) : (
                orgs.map((org) => (
                  <tr key={org.id} className="group">
                    {/* Organization */}
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <p className="font-semibold text-ink">{org.name}</p>
                      <p className="text-xs text-dim">{org.primaryContactEmail}</p>
                    </td>
                    {/* Type */}
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Badge variant="dim">{org.type}</Badge>
                    </td>
                    {/* Plan */}
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <PlanBadge plan={org.plan} />
                    </td>
                    {/* Users */}
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <span className="font-mono font-bold text-ink">{org.totalMembers}</span>
                    </td>
                    {/* Active Rate */}
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <div className="flex items-center gap-2">
                        <div className="h-[6px] w-[80px] overflow-hidden rounded-full bg-[#EDE7DC]">
                          <div
                            className="h-full rounded-full bg-[#4E8C58]"
                            style={{ width: `${Math.min(org.activeRate, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-mid">{Math.round(org.activeRate)}%</span>
                      </div>
                    </td>
                    {/* Coaches */}
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {org.totalCoaches}
                    </td>
                    {/* MRR */}
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <span className="font-mono text-sm text-[#4E8C58]">
                        ${org.monthlySpend.toLocaleString()}/mo
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        className="mr-1"
                        onClick={() => router.push("/org/dashboard")}
                      >
                        Dashboard
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        onClick={() => openEdit(org)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      </div>

      {/* ── Add Partner Modal ── */}
      <BaseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Partner Organization"
      >
        <div className="space-y-4">
          <div>
            <Label>Organization Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="State University System"
            />
          </div>
          <div>
            <Label>Type *</Label>
            <Select
              options={TYPE_OPTIONS}
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v })}
            />
          </div>
          <div>
            <Label>Plan *</Label>
            <Select
              options={PLAN_OPTIONS}
              value={form.plan}
              onChange={(v) => setForm({ ...form, plan: v })}
            />
          </div>
          <div>
            <Label>Primary Contact Name *</Label>
            <Input
              value={form.primaryContactName}
              onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })}
              placeholder="Dr. Jane Chen"
            />
          </div>
          <div>
            <Label>Primary Contact Email *</Label>
            <Input
              type="email"
              value={form.primaryContactEmail}
              onChange={(e) => setForm({ ...form, primaryContactEmail: e.target.value })}
              placeholder="admin@university.edu"
            />
          </div>
          <div>
            <Label>Password *</Label>
            <Input
              type="password"
              value={form.primaryContactPassword}
              onChange={(e) => setForm({ ...form, primaryContactPassword: e.target.value })}
              placeholder="Set org admin login password"
            />
            <p className="mt-1 text-xs text-dim">This will be the org admin's login password.</p>
          </div>
          <div>
            <Label>Monthly Spend ($)</Label>
            <Input
              type="number"
              value={form.monthlySpend ?? ""}
              onChange={(e) => setForm({ ...form, monthlySpend: Number(e.target.value) })}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Domain</Label>
            <Input
              value={form.domain ?? ""}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder="university.edu"
            />
          </div>
          {addError && (
            <p className="rounded-[8px] bg-[#FAE0DC] px-3 py-2 text-sm text-danger">{addError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              type="button"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              type="button"
              onClick={handleCreate}
              disabled={createOrg.isPending}
            >
              {createOrg.isPending ? "Creating…" : "Create Organization"}
            </Button>
          </div>
        </div>
      </BaseModal>

      {/* ── Edit Org Modal ── */}
      <BaseModal
        open={!!editingOrg}
        onClose={() => setEditingOrg(null)}
        title="Edit Organization"
      >
        {editingOrg && (
          <div className="space-y-4">
            <div>
              <Label>Organization Name</Label>
              <Input
                value={editForm.name ?? ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Organization name"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                options={TYPE_OPTIONS}
                value={editForm.type ?? "University"}
                onChange={(v) => setEditForm({ ...editForm, type: v })}
              />
            </div>
            <div>
              <Label>Plan</Label>
              <Select
                options={PLAN_OPTIONS}
                value={editForm.plan ?? "Starter"}
                onChange={(v) => setEditForm({ ...editForm, plan: v })}
              />
            </div>
            <div>
              <Label>Primary Contact Name</Label>
              <Input
                value={editForm.primaryContactName ?? ""}
                onChange={(e) => setEditForm({ ...editForm, primaryContactName: e.target.value })}
                placeholder="Contact name"
              />
            </div>
            <div>
              <Label>Primary Contact Email</Label>
              <Input
                type="email"
                value={editingOrg.primaryContactEmail}
                disabled
                className="opacity-50"
              />
            </div>
            <div>
              <Label>Monthly Spend ($)</Label>
              <Input
                type="number"
                value={editForm.monthlySpend ?? ""}
                onChange={(e) => setEditForm({ ...editForm, monthlySpend: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            {editError && (
              <p className="rounded-[8px] bg-[#FAE0DC] px-3 py-2 text-sm text-danger">{editError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1"
                type="button"
                onClick={() => setEditingOrg(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                type="button"
                onClick={handleEdit}
                disabled={updateOrg.isPending}
              >
                {updateOrg.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </BaseModal>
    </DashboardLayout>
  );
}
