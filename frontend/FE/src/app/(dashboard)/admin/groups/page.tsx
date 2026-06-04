"use client";
import api from "@/lib/api";
import { useState } from "react";
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
  useAdminGroups,
  useArchiveAdminGroup,
  useCreateAdminGroup,
  useUpdateAdminGroup,
} from "@/hooks/admin/useAdminGroups";
import { cn } from "@/lib/cn";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const EMOJIS = ["🌿", "🌈", "📚", "🧘", "✊🏾", "🌍", "💚", "🦋"];

// Fetch coaches from the existing /api/auth/coaches endpoint
function useCoaches() {
  return useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const res = await api.get<{ id: string; name: string }[]>("/api/auth/coaches");
      return res.data;
    },
  });
}

// Reusable moderator dropdown
function ModeratorSelect({
  value,
  onChange,
  coaches,
}: {
  value: string;
  onChange: (v: string) => void;
  coaches: { id: string; name: string }[];
}) {
  return (
    <div>
      <Label>Moderator</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-sage"
      >
        <option value="">— Select moderator —</option>
        {coaches.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminGroupsPage() {
  const dispatch = useAppDispatch();
  const { data: groups = [], isPending } = useAdminGroups();
  const { data: coaches = [] } = useCoaches();
  const createGroup = useCreateAdminGroup();
  const updateGroup = useUpdateAdminGroup();
  const archiveGroup = useArchiveAdminGroup();
  const modal = useAppSelector((s) => s.ui.modal);

  const [searchQuery, setSearchQuery] = useState("");
  // Create group state
  const [gname, setGname] = useState("");
  const [tags, setTags] = useState("");
  const [emoji, setEmoji] = useState("🌿");
  const [mod, setMod] = useState("");

  // Edit group state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("🌿");
  const [editDescription, setEditDescription] = useState("");
  const [editMod, setEditMod] = useState("");

  const submit = () => {
    if (!gname.trim()) {
      toast.error("Group name required");
      return;
    }
    createGroup.mutate(
      {
        name: gname.trim(),
        emoji,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        mod: mod || undefined,
      },
      {
        onSuccess: () => {
          dispatch(closeModal());
          setGname("");
          setTags("");
          setEmoji("🌿");
          setMod("");
          toast.success("Group created");
        },
        onError: () => toast.error("Failed to create group"),
      }
    );
  };

  const openEdit = (
    id: string,
    currentName: string,
    currentEmoji: string,
    currentDescription: string | null,
    currentMod: string | null
  ) => {
    setEditId(id);
    setEditName(currentName);
    setEditEmoji(currentEmoji);
    setEditDescription(currentDescription ?? "");
    setEditMod(currentMod ?? "");
    dispatch(openModal("edit-group"));
  };

  const submitEdit = () => {
    if (!editId || !editName.trim()) {
      toast.error("Group name required");
      return;
    }
    updateGroup.mutate(
      {
        id: editId,
        data: {
          name: editName.trim(),
          emoji: editEmoji,
          description: editDescription || null,
          mod: editMod || null,
        },
      },
      {
        onSuccess: () => {
          dispatch(closeModal());
          setEditId(null);
          toast.success("Group updated");
        },
        onError: () => toast.error("Failed to update group"),
      }
    );
  };

  const filteredGroups = groups.filter((g) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      g.name.toLowerCase().includes(query) ||
      (g.mod && g.mod.toLowerCase().includes(query))
    );
  });

  return (
    <DashboardLayout title="Community Groups">
      <div className="anim-up">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="serif text-lg font-semibold text-ink">Community Groups</h3>
          <Button size="sm" type="button" onClick={() => dispatch(openModal("add-group"))}>
            + Create Group
          </Button>
        </div>
        <TableWrap>
          <TableToolbar title={`All Groups (${groups.length})`} />
          <div className="px-[22px] py-3 border-b border-line">
            <input
              type="text"
              placeholder="Search by group name or moderator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-sage"
            />
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Group", "Members", "Posts", "Moderator", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b-[1.5px] border-line bg-[var(--bg-surface-2)] px-[22px] py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid text-ink">
                    Loading groups…
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => (
                  <tr key={g.id} className="group text-ink">
                    <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{g.emoji}</span>
                        <span className="font-semibold">{g.name}</span>
                      </div>
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                      {g.memberCount}
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                      {g.postCount}
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] text-sm text-mid group-hover:bg-[var(--bg-surface-2)]">
                      {g.mod ?? "—"}
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                      <Badge
                        variant={
                          g.status === "active"
                            ? "sage"
                            : g.status === "archived"
                              ? "dim"
                              : "gold"
                        }
                      >
                        {g.status}
                      </Badge>
                    </td>
                    <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        className="mr-1"
                        onClick={() => openEdit(g.id, g.name, g.emoji, g.description ?? null, g.mod)}
                      >
                        Edit
                      </Button>
                      {g.status === "archived" ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          className="text-sage"
                          onClick={() =>
                            updateGroup.mutate(
                              { id: g.id, data: { status: "active" } },
                              {
                                onSuccess: () => toast.success("Group reactivated"),
                                onError: () => toast.error("Failed to reactivate group"),
                              }
                            )
                          }
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          className="text-danger"
                          onClick={() =>
                            archiveGroup.mutate(g.id, {
                              onSuccess: () => toast.success("Group archived"),
                              onError: () => toast.error("Failed to archive group"),
                            })
                          }
                        >
                          Archive
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

      {/* Create Group Modal */}
      <BaseModal
        open={modal === "add-group"}
        onClose={() => dispatch(closeModal())}
        title="Create Community Group"
      >
        <div className="space-y-4">
          <div>
            <Label>Group Name</Label>
            <Input value={gname} onChange={(e) => setGname(e.target.value)} placeholder="Group name" />
          </div>
          <div>
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border-[1.5px] border-line bg-card text-xl",
                    emoji === e && "border-sage bg-sage-soft"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Tags</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. BIPOC, LGBTQ+" />
          </div>
          <ModeratorSelect value={mod} onChange={setMod} coaches={coaches} />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" type="button" onClick={() => dispatch(closeModal())}>
              Cancel
            </Button>
            <Button className="flex-1" type="button" onClick={submit}>
              Create Group
            </Button>
          </div>
        </div>
      </BaseModal>

      {/* Edit Group Modal */}
      <BaseModal
        open={modal === "edit-group"}
        onClose={() => dispatch(closeModal())}
        title="Edit Community Group"
      >
        <div className="space-y-4">
          <div>
            <Label>Group Name</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Group name" />
          </div>
          <div>
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEditEmoji(e)}
                  className={cn(
                    "flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border-[1.5px] border-line bg-card text-xl",
                    editEmoji === e && "border-sage bg-sage-soft"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <ModeratorSelect value={editMod} onChange={setEditMod} coaches={coaches} />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" type="button" onClick={() => dispatch(closeModal())}>
              Cancel
            </Button>
            <Button className="flex-1" type="button" onClick={submitEdit} disabled={updateGroup.isPending}>
              {updateGroup.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </BaseModal>
    </DashboardLayout>
  );
}