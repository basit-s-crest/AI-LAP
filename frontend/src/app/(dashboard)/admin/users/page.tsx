"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAdminUsers, useDeleteAdminUser, useUpdateAdminUser } from "@/hooks/admin/useAdminUsers";
import { toast } from "sonner";

type EditState = {
  id: string;
  name: string;
  isVerified: boolean;
};

export default function AdminUsersPage() {
  const { data: users = [], isPending } = useAdminUsers();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const [editTarget, setEditTarget] = useState<EditState | null>(null);
  const [editName, setEditName] = useState("");
  const [editVerified, setEditVerified] = useState(false);

  const openEdit = (id: string, currentName: string, currentVerified: boolean) => {
    setEditTarget({ id, name: currentName, isVerified: currentVerified });
    setEditName(currentName);
    setEditVerified(currentVerified);
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

  return (
    <DashboardLayout title="User Management">
      <TableWrap>
        <TableToolbar title={`All Users (${users.length})`} />
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["User", "Role", "Verified", "Groups", "Messages", ""].map((h) => (
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
              users.map((u) => (
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
                    {u.messageCount}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      className="mr-1"
                      onClick={() => openEdit(u.id, u.name, u.isVerified)}
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