"use client";

import { useState, useRef, useEffect } from "react";
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
  useAdminAllCoaches,
  useCreateOrg,
  useUpdateOrg,
  type AdminOrg,
  type OrgCoach,
  type CreateOrgPayload,
} from "@/hooks/admin/useAdminOrgs";

// ── Stat card ─────────────────────────────────────────────────────────────────
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

// ── Plan badge ────────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  if (plan === "Enterprise") return <Badge variant="gold">Enterprise</Badge>;
  if (plan === "Pro")        return <Badge variant="blue">Pro</Badge>;
  return <Badge variant="dim">{plan}</Badge>;
}

// ── Coach multi-select dropdown ───────────────────────────────────────────────
function CoachMultiSelect({
  coaches,
  selected,
  onChange,
}: {
  coaches: OrgCoach[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const filtered = coaches.filter(
    (c) =>
      c.isActive &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.speciality ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const selectedCoaches = coaches.filter((c) => selected.includes(c.id));

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3 py-2 text-left text-[13.5px] text-ink outline-none focus:border-[#4E8C58] focus:shadow-[0_0_0_3px_#EBF5EC]"
      >
        {selectedCoaches.length === 0 ? (
          <span className="text-dim">Select coaches…</span>
        ) : (
          selectedCoaches.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1 rounded-full bg-[#EBF5EC] px-2 py-0.5 text-xs font-medium text-[#4E8C58]"
            >
              {c.name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(c.id); }}
                className="ml-0.5 text-[#4E8C58] hover:text-[#2d5c35]"
              >
                ×
              </button>
            </span>
          ))
        )}
        <span className="ml-auto text-dim">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[10px] border-[1.5px] border-line bg-card shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coaches…"
              className="w-full rounded-[7px] border border-[rgba(60,50,40,0.12)] bg-[#F7F3EE] px-3 py-1.5 text-sm outline-none focus:border-[#4E8C58]"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-dim">No coaches found</li>
            ) : (
              filtered.map((coach) => {
                const checked = selected.includes(coach.id);
                return (
                  <li key={coach.id}>
                    <button
                      type="button"
                      onClick={() => toggle(coach.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F0EBE1]"
                    >
                      {/* Checkbox */}
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
                          checked
                            ? "border-[#4E8C58] bg-[#4E8C58]"
                            : "border-[rgba(60,50,40,0.25)] bg-white"
                        }`}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-ink">{coach.name}</span>
                        {coach.speciality && (
                          <span className="block text-xs text-dim">{coach.speciality}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
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

const BLANK: CreateOrgPayload = {
  name: "",
  type: "University",
  plan: "Starter",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPassword: "",
  monthlySpend: 0,
  domain: "",
  coachIds: [],
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminOrgsPage() {
  const router = useRouter();
  const { data: orgs = [], isPending } = useAdminOrgs();
  const { data: stats } = useAdminOrgStats();
  const { data: allCoaches = [] } = useAdminAllCoaches();
  const createOrg = useCreateOrg();
  const updateOrg = useUpdateOrg();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<AdminOrg | null>(null);

  // Add form
  const [form, setForm] = useState<CreateOrgPayload>(BLANK);
  const [addError, setAddError] = useState("");

  // Edit form
  const [editForm, setEditForm] = useState<Partial<AdminOrg> & { coachIds?: string[] }>({});
  const [editError, setEditError] = useState("");

  const openEdit = (org: AdminOrg) => {
    setEditingOrg(org);
    setEditForm({
      name: org.name,
      type: org.type,
      plan: org.plan,
      primaryContactName: org.primaryContactName,
      monthlySpend: org.monthlySpend,
      coachIds: org.coaches?.map((c) => c.id) ?? [],
    });
    setEditError("");
  };

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
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to create organization";
        setAddError(msg);
      },
    });
  };

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
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "Failed to update organization";
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
          <StatCard label="Total Partners"  value={stats?.totalPartners ?? "—"}                          sub="Active contracts"          accent="sage"  />
          <StatCard label="Total Members"   value={stats ? stats.totalMembers.toLocaleString() : "—"}    sub="Across all orgs"           accent="gold"  />
          <StatCard label="MRR"             value={stats ? `$${(stats.totalMRR / 1000).toFixed(1)}k` : "—"} sub="Monthly recurring revenue" accent="blue"  />
          <StatCard label="Active Coaches"  value={stats?.totalCoaches ?? "—"}                           sub="Across all orgs"           accent="terra" />
        </div>

        {/* ── Orgs table ── */}
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
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <p className="font-semibold text-ink">{org.name}</p>
                      <p className="text-xs text-dim">{org.primaryContactEmail}</p>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Badge variant="dim">{org.type}</Badge>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <PlanBadge plan={org.plan} />
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <span className="font-mono font-bold text-ink">{org.totalMembers}</span>
                    </td>
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
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-ink">{org.totalCoaches}</span>
                        {org.coaches?.length > 0 && (
                          <div className="flex -space-x-1">
                            {org.coaches.slice(0, 3).map((c) => (
                              <span
                                key={c.id}
                                title={c.name}
                                className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[#4E8C58] text-[9px] font-bold text-white"
                              >
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                            ))}
                            {org.coaches.length > 3 && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[#EDE7DC] text-[9px] font-bold text-dim">
                                +{org.coaches.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <span className="font-mono text-sm text-[#4E8C58]">
                        ${org.monthlySpend.toLocaleString()}/mo
                      </span>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Button variant="ghost" size="xs" type="button" className="mr-1" onClick={() => router.push("/org/dashboard")}>
                        Dashboard
                      </Button>
                      <Button variant="ghost" size="xs" type="button" onClick={() => openEdit(org)}>
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
      <BaseModal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Partner Organization">
        <div className="space-y-4">
          <div>
            <Label>Organization Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="State University System" />
          </div>
          <div>
            <Label>Type *</Label>
            <Select options={TYPE_OPTIONS} value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
          </div>
          <div>
            <Label>Plan *</Label>
            <Select options={PLAN_OPTIONS} value={form.plan} onChange={(v) => setForm({ ...form, plan: v })} />
          </div>
          <div>
            <Label>Primary Contact Name *</Label>
            <Input value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} placeholder="Dr. Jane Chen" />
          </div>
          <div>
            <Label>Primary Contact Email *</Label>
            <Input type="email" value={form.primaryContactEmail} onChange={(e) => setForm({ ...form, primaryContactEmail: e.target.value })} placeholder="admin@university.edu" />
          </div>
          <div>
            <Label>Password *</Label>
            <Input type="password" value={form.primaryContactPassword} onChange={(e) => setForm({ ...form, primaryContactPassword: e.target.value })} placeholder="Set org admin login password" />
            <p className="mt-1 text-xs text-dim">This will be the org admin's login password.</p>
          </div>
          <div>
            <Label>Assign Coaches</Label>
            <CoachMultiSelect
              coaches={allCoaches}
              selected={form.coachIds ?? []}
              onChange={(ids) => setForm({ ...form, coachIds: ids })}
            />
            <p className="mt-1 text-xs text-dim">Select one or more coaches to assign to this organization.</p>
          </div>
          <div>
            <Label>Monthly Spend ($)</Label>
            <Input type="number" value={form.monthlySpend ?? ""} onChange={(e) => setForm({ ...form, monthlySpend: Number(e.target.value) })} placeholder="0" />
          </div>
          <div>
            <Label>Domain</Label>
            <Input value={form.domain ?? ""} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="university.edu" />
          </div>
          {addError && (
            <p className="rounded-[8px] bg-[#FAE0DC] px-3 py-2 text-sm text-danger">{addError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" type="button" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button className="flex-1" type="button" onClick={handleCreate} disabled={createOrg.isPending}>
              {createOrg.isPending ? "Creating…" : "Create Organization"}
            </Button>
          </div>
        </div>
      </BaseModal>

      {/* ── Edit Org Modal ── */}
      <BaseModal open={!!editingOrg} onClose={() => setEditingOrg(null)} title="Edit Organization">
        {editingOrg && (
          <div className="space-y-4">
            <div>
              <Label>Organization Name</Label>
              <Input value={editForm.name ?? ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Organization name" />
            </div>
            <div>
              <Label>Type</Label>
              <Select options={TYPE_OPTIONS} value={editForm.type ?? "University"} onChange={(v) => setEditForm({ ...editForm, type: v })} />
            </div>
            <div>
              <Label>Plan</Label>
              <Select options={PLAN_OPTIONS} value={editForm.plan ?? "Starter"} onChange={(v) => setEditForm({ ...editForm, plan: v })} />
            </div>
            <div>
              <Label>Primary Contact Name</Label>
              <Input value={editForm.primaryContactName ?? ""} onChange={(e) => setEditForm({ ...editForm, primaryContactName: e.target.value })} placeholder="Contact name" />
            </div>
            <div>
              <Label>Primary Contact Email</Label>
              <Input type="email" value={editingOrg.primaryContactEmail} disabled className="opacity-50" />
            </div>
            <div>
              <Label>Assign Coaches</Label>
              <CoachMultiSelect
                coaches={allCoaches}
                selected={editForm.coachIds ?? []}
                onChange={(ids) => setEditForm({ ...editForm, coachIds: ids })}
              />
            </div>
            <div>
              <Label>Monthly Spend ($)</Label>
              <Input type="number" value={editForm.monthlySpend ?? ""} onChange={(e) => setEditForm({ ...editForm, monthlySpend: Number(e.target.value) })} placeholder="0" />
            </div>
            {editError && (
              <p className="rounded-[8px] bg-[#FAE0DC] px-3 py-2 text-sm text-danger">{editError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" type="button" onClick={() => setEditingOrg(null)}>Cancel</Button>
              <Button className="flex-1" type="button" onClick={handleEdit} disabled={updateOrg.isPending}>
                {updateOrg.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </BaseModal>
    </DashboardLayout>
  );
}
