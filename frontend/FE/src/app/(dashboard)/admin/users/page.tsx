"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
} from "@/hooks/admin/useAdminUsers";
import { useAdminOrgs } from "@/hooks/admin/useAdminOrgs";
import { toast } from "sonner";
import type { AdminUser } from "@/types/admin";

type EditState = {
  id: string;
  name: string;
  isVerified: boolean;
  organizationId?: string | null;
};

export default function AdminUsersPage() {
  const { data: users = [], isPending } = useAdminUsers();
  const { data: orgs = [] } = useAdminOrgs();
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addVerified, setAddVerified] = useState(true);
  const [addOrgId, setAddOrgId] = useState("");
  const [editTarget, setEditTarget] = useState<EditState | null>(null);
  const [editName, setEditName] = useState("");
  const [editVerified, setEditVerified] = useState(false);
  const [editOrgId, setEditOrgId] = useState("");

  const openEdit = (id: string, currentName: string, currentVerified: boolean, currentOrgId?: string | null) => {
    setEditTarget({ id, name: currentName, isVerified: currentVerified, organizationId: currentOrgId });
    setEditName(currentName);
    setEditVerified(currentVerified);
    setEditOrgId(currentOrgId || "");
  };

  const resetAddForm = () => {
    setAddName("");
    setAddEmail("");
    setAddPassword("");
    setAddVerified(true);
    setAddOrgId("");
  };

  const handleCreate = () => {
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      toast.error("Name, email and password are required");
      return;
    }

    createUser.mutate(
      {
        name: addName.trim(),
        email: addEmail.trim(),
        password: addPassword,
        role: "member",
        isVerified: addVerified,
        organizationId: addOrgId || undefined,
      },
      {
        onSuccess: () => {
          toast.success("User added");
          setAddOpen(false);
          resetAddForm();
        },
        onError: (error) => toast.error(error.message || "Failed to add user"),
      }
    );
  };

  const handleSave = () => {
    if (!editTarget) return;
    updateUser.mutate(
      {
        id: editTarget.id,
        data: {
          name: editName,
          role: "member",
          isVerified: editVerified,
          organizationId: editOrgId || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("User updated");
          setEditTarget(null);
        },
        onError: () => toast.error("Failed to update user"),
      }
    );
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  });

  return (
    <DashboardLayout title="User Management">
      <TableWrap>
        <TableToolbar title={`All Users (${users.length})`}>
          <Button size="sm" type="button" onClick={() => setAddOpen(true)}>
            + Add User
          </Button>
        </TableToolbar>
        <div className="px-[22px] py-3 border-b border-[rgba(60,50,40,0.08)]">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
          />
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["User", "Role", "Verified", "Groups", "Last Active", ""].map((h) => (
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
                  Loading users…
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="group">
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-mid">{u.email}</div>
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    {u.role}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <Badge variant={u.isVerified ? "sage" : "gold"}>{u.isVerified ? "verified" : "pending"}</Badge>
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    {u.groupCount}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    {u.lastActiveAt
                      ? new Date(u.lastActiveAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "---"}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      className="mr-1"
                      onClick={() => setViewingUser(u)}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      className="mr-1"
                      onClick={() => openEdit(u.id, u.name, u.isVerified, u.organizationId)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      className="text-danger"
                      onClick={() =>
                        deleteUser.mutate(u.id, {
                          onSuccess: () => toast.success("User deleted"),
                          onError: () => toast.error("Failed to delete user"),
                        })
                      }
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableWrap>

      {/* View User Modal */}
      {viewingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingUser(null); }}
        >
          <div className="w-[480px] max-w-[95vw] rounded-2xl border border-[rgba(60,50,40,0.10)] bg-[#FDFAF5] p-7 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-[#1E1A16]">{viewingUser.name}</h2>
              <button
                onClick={() => setViewingUser(null)}
                className="rounded-md border border-[rgba(60,50,40,0.12)] px-2.5 py-1 text-xs text-[#5C5248] hover:bg-[#F0EBE1]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Email</p>
                <p className="text-[13.5px] text-[#1E1A16]">{viewingUser.email}</p>
              </div>
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Role</p>
                <p className="text-[13.5px] text-[#1E1A16]">{viewingUser.role}</p>
              </div>
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Verified</p>
                <Badge variant={viewingUser.isVerified ? "sage" : "gold"}>
                  {viewingUser.isVerified ? "Verified" : "Pending"}
                </Badge>
              </div>
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Groups</p>
                <p className="text-[13.5px] text-[#1E1A16]">{viewingUser.groupCount}</p>
              </div>
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Messages</p>
                <p className="text-[13.5px] text-[#1E1A16]">{viewingUser.messageCount}</p>
              </div>
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Organization</p>
                <p className="text-[13.5px] text-[#1E1A16]">
                  {orgs.find((o) => o.id === viewingUser.organizationId)?.name || "None"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-dim">Created</p>
                <p className="text-[13.5px] text-[#1E1A16]">
                  {new Date(viewingUser.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <Button variant="ghost" className="w-full" onClick={() => setViewingUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddOpen(false);
          }}
        >
          <div className="w-[480px] max-w-[95vw] rounded-2xl border border-[rgba(60,50,40,0.10)] bg-[#FDFAF5] p-7 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-[#1E1A16]">Add User</h2>
              <button
                onClick={() => setAddOpen(false)}
                className="rounded-md border border-[rgba(60,50,40,0.12)] px-2.5 py-1 text-xs text-[#5C5248] hover:bg-[#F0EBE1]"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-dim">
                Full Name
              </label>
              <input
                className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Member name"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-dim">
                Email
              </label>
              <input
                className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="member@example.com"
                type="email"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-dim">
                Temporary Password
              </label>
              <input
                className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Set temporary password"
                type="password"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-dim">
                Verified
              </label>
              <select
                className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
                value={String(addVerified)}
                onChange={(e) => setAddVerified(e.target.value === "true")}
              >
                <option value="true">Verified</option>
                <option value="false">Pending</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-dim">
                Organization
              </label>
              <select
                className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
                value={addOrgId}
                onChange={(e) => setAddOrgId(e.target.value)}
              >
                <option value="">None</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleCreate}
                disabled={createUser.isPending}
              >
                {createUser.isPending ? "Adding…" : "Add User"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null); }}
        >
          <div className="w-[480px] max-w-[95vw] rounded-2xl border border-[rgba(60,50,40,0.10)] bg-[#FDFAF5] p-7 shadow-xl">
            
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-[#1E1A16]">Edit User</h2>
              <button
                onClick={() => setEditTarget(null)}
                className="rounded-md border border-[rgba(60,50,40,0.12)] px-2.5 py-1 text-xs text-[#5C5248] hover:bg-[#F0EBE1]"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-dim">
                Full Name
              </label>
              <input
                className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-dim">
                Verified
              </label>
              <select
                className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
                value={String(editVerified)}
                onChange={(e) => setEditVerified(e.target.value === "true")}
              >
                <option value="true">Verified</option>
                <option value="false">Pending</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-dim">
                Organization
              </label>
              <select
                className="w-full rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
                value={editOrgId}
                onChange={(e) => setEditOrgId(e.target.value)}
              >
                <option value="">None</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleSave} disabled={updateUser.isPending}>
                {updateUser.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>

          </div>
        </div>
      )}
    </DashboardLayout>
  );
}