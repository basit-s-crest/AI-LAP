"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BaseModal } from "@/components/modals/BaseModal";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { closeModal, openModal } from "@/store/slices/uiSlice";
import {
  useAdminCoaches,
  useCreateAdminCoach,
  useRemoveAdminCoach,
  useUpdateAdminCoach,
} from "@/hooks/admin/useAdminCoaches";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AdminCoach } from "@/types/admin";
import { toast } from "sonner";

type EditState = {
  id: string;
  name: string;
  spec: string;
  bio: string;
  organizationIds: string[];
};

function useOrganizations() {
  return useQuery({
    queryKey: ["admin", "orgs"],
    queryFn: async () => {
      const { data } = await api.get<{ id: string; name: string }[]>("/api/admin/orgs");
      return data;
    },
  });
}

// Multi-select checkboxes for organizations
function OrgMultiSelect({
  value,
  onChange,
  organizations,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  organizations: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const filtered = organizations.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOrgs = organizations.filter((o) => value.includes(o.id));

  return (
    <div>
      <Label>Organizations</Label>
      <div ref={ref} className="relative">
        {/* Trigger */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3 py-2 text-left text-[13.5px] text-ink outline-none focus:border-[#4E8C58] focus:shadow-[0_0_0_3px_#EBF5EC]"
        >
          {selectedOrgs.length === 0 ? (
            <span className="text-dim">Select organizations…</span>
          ) : (
            selectedOrgs.map((o) => (
              <span
                key={o.id}
                className="flex items-center gap-1 rounded-full bg-[#EBF5EC] px-2 py-0.5 text-xs font-medium text-[#4E8C58]"
              >
                {o.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(o.id);
                  }}
                  className="ml-0.5 text-[#4E8C58] hover:text-[#2d5c35]"
                >
                  ×
                </button>
              </span>
            ))
          )}
          <span className="ml-auto text-dim">▾</span>
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-[10px] border-[1.5px] border-line bg-card shadow-lg">
            <div className="p-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organizations…"
                className="w-full rounded-[7px] border border-[rgba(60,50,40,0.12)] bg-[#F7F3EE] px-3 py-1.5 text-sm outline-none focus:border-[#4E8C58]"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto pb-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-dim">No organizations found</li>
              ) : (
                filtered.map((org) => {
                  const checked = value.includes(org.id);
                  return (
                    <li key={org.id}>
                      <button
                        type="button"
                        onClick={() => toggle(org.id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F0EBE1]"
                      >
                        <span
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
                            checked
                              ? "border-[#4E8C58] bg-[#4E8C58]"
                              : "border-[rgba(60,50,40,0.25)] bg-white"
                          }`}
                        >
                          {checked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path
                                d="M1 4l3 3 5-6"
                                stroke="white"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="block text-sm font-medium text-ink">{org.name}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminCoachesPage() {
  const dispatch = useAppDispatch();
  const { data: coaches = [], isPending } = useAdminCoaches();
  const { data: organizations = [] } = useOrganizations();
  const createCoach = useCreateAdminCoach();
  const updateCoach = useUpdateAdminCoach();
  const removeCoach = useRemoveAdminCoach();
  const modal = useAppSelector((s) => s.ui.modal);

  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("coach1234");
  const [addOrgIds, setAddOrgIds] = useState<string[]>([]);

  const [editState, setEditState] = useState<EditState | null>(null);
  const [viewingCoach, setViewingCoach] = useState<AdminCoach | null>(null);

  const submit = () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Name, email and password are required");
      return;
    }

    createCoach.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        speciality: spec || undefined,
        bio: bio || undefined,
        organizationIds: addOrgIds,
      },
      {
        onSuccess: () => {
          dispatch(closeModal());
          setName("");
          setSpec("");
          setBio("");
          setEmail("");
          setPassword("coach1234");
          setAddOrgIds([]);
          toast.success("Coach added");
        },
        onError: () => toast.error("Failed to add coach"),
      }
    );
  };

  const handleEditSave = () => {
    if (!editState) return;
    updateCoach.mutate(
      {
        id: editState.id,
        data: {
          name: editState.name,
          speciality: editState.spec || null,
          bio: editState.bio || null,
          organizationIds: editState.organizationIds,
        },
      },
      {
        onSuccess: () => {
          toast.success("Coach updated");
          setEditState(null);
        },
        onError: () => toast.error("Failed to update coach"),
      }
    );
  };

  const filteredCoaches = coaches.filter((c) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const orgNames = c.organizations?.map((o) => o.name.toLowerCase()).join(" ") || "";
    return (
      c.name.toLowerCase().includes(query) ||
      orgNames.includes(query)
    );
  });

  return (
    <DashboardLayout title="Coach Management">
      <div className="animate-fadeIn">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">Coach Management</h3>
          <Button size="sm" type="button" onClick={() => dispatch(openModal("add-coach"))}>
            + Add Coach
          </Button>
        </div>
        <TableWrap>
          <TableToolbar title={`All Coaches (${coaches.length})`} />
          <div className="px-[22px] py-3 border-b border-[rgba(60,50,40,0.08)]">
            <input
              type="text"
              placeholder="Search by name or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
            />
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Coach", "Specialty", "Availability", "Members", "Orgs", ""].map((h) => (
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
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid">
                    Loading coaches…
                  </td>
                </tr>
              ) : (
                filteredCoaches.map((c) => (
                  <tr key={c.id} className="group">
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5DDD4] text-base">
                          {c.avatar ?? "👤"}
                        </div>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-mid group-hover:bg-[#EDE7DC]">
                      {c.speciality ?? "—"}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Badge variant={c.isActive ? "sage" : "dim"}>
                        {c.isActive ? "active" : "inactive"}
                      </Badge>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {c.memberCount}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-xs text-mid group-hover:bg-[#EDE7DC]">
                      {c.organizations?.length > 0
                        ? c.organizations.map((o) => o.name).join(", ")
                        : "—"}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        className="mr-1"
                        onClick={() => setViewingCoach(c)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        className="mr-1"
                        onClick={() =>
                          setEditState({
                            id: c.id,
                            name: c.name,
                            spec: c.speciality ?? "",
                            bio: c.bio ?? "",
                            organizationIds: c.organizations?.map((o) => o.id) ?? [],
                          })
                        }
                      >
                        Edit
                      </Button>
                      {c.isActive ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          className="text-danger"
                          onClick={() =>
                            removeCoach.mutate(c.id, {
                              onSuccess: () => toast.success("Coach removed"),
                              onError: () => toast.error("Failed to remove coach"),
                            })
                          }
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          className="text-sage"
                          onClick={() =>
                            updateCoach.mutate(
                              { id: c.id, data: { isActive: true } },
                              {
                                onSuccess: () => toast.success("Coach activated"),
                                onError: () => toast.error("Failed to activate coach"),
                              }
                            )
                          }
                        >
                          Activate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      </div>

      {/* ── View Coach Modal ── */}
      <BaseModal
        open={!!viewingCoach}
        onClose={() => setViewingCoach(null)}
        title={viewingCoach?.name ?? ""}
      >
        {viewingCoach && (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Email</p>
              <p className="text-[13.5px] text-ink">{viewingCoach.email}</p>
            </div>
            <div>
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Specialty</p>
              <p className="text-[13.5px] text-ink">{viewingCoach.speciality ?? "—"}</p>
            </div>
            <div>
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Bio</p>
              <p className="text-[13.5px] text-ink">{viewingCoach.bio ?? "—"}</p>
            </div>
            <div>
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Organizations</p>
              <p className="text-[13.5px] text-ink">
                {viewingCoach.organizations?.length > 0
                  ? viewingCoach.organizations.map((o) => o.name).join(", ")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Status</p>
              <Badge variant={viewingCoach.isActive ? "sage" : "dim"}>
                {viewingCoach.isActive ? "active" : "inactive"}
              </Badge>
            </div>
            <div>
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Members</p>
              <p className="text-[13.5px] text-ink">{viewingCoach.memberCount}</p>
            </div>
            <div>
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Created</p>
              <p className="text-[13.5px] text-ink">
                {new Date(viewingCoach.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="pt-2">
              <Button className="w-full" variant="ghost" type="button" onClick={() => setViewingCoach(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </BaseModal>

      {/* ── Add Coach Modal ── */}
      <BaseModal
        open={modal === "add-coach"}
        onClose={() => dispatch(closeModal())}
        title="Add New Coach"
      >
        <div className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Smith" />
          </div>
          <div>
            <Label>Specialty</Label>
            <Input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="e.g. CBT · Trauma" />
          </div>
          <div>
            <Label>Bio</Label>
            <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio..." />
          </div>
          <OrgMultiSelect
            value={addOrgIds}
            onChange={setAddOrgIds}
            organizations={organizations}
          />
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@email.com"
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="coach1234"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" type="button" onClick={() => dispatch(closeModal())}>
              Cancel
            </Button>
            <Button className="flex-1" type="button" onClick={submit}>
              Add Coach
            </Button>
          </div>
        </div>
      </BaseModal>

      {/* ── Edit Coach Modal ── */}
      <BaseModal
        open={!!editState}
        onClose={() => setEditState(null)}
        title="Edit Coach"
      >
        {editState && (
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editState.name}
                onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                placeholder="Dr. Jane Smith"
              />
            </div>
            <div>
              <Label>Specialty</Label>
              <Input
                value={editState.spec}
                onChange={(e) => setEditState({ ...editState, spec: e.target.value })}
                placeholder="e.g. CBT · Trauma"
              />
            </div>
            <div>
              <Label>Bio</Label>
              <Input
                value={editState.bio}
                onChange={(e) => setEditState({ ...editState, bio: e.target.value })}
                placeholder="Short bio..."
              />
            </div>
            <OrgMultiSelect
              value={editState.organizationIds}
              onChange={(ids) => setEditState({ ...editState, organizationIds: ids })}
              organizations={organizations}
            />
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" type="button" onClick={() => setEditState(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                type="button"
                onClick={handleEditSave}
                disabled={updateCoach.isPending}
              >
                {updateCoach.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </BaseModal>
    </DashboardLayout>
  );
}