"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAdminUsers, useDeleteAdminUser, useUpdateAdminUser } from "@/hooks/admin/useAdminUsers";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const { data: users = [], isPending } = useAdminUsers();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const editUser = (id: string, currentName: string, currentRole: string, currentVerified: boolean) => {
    const nextName = window.prompt("User name", currentName);
    if (!nextName) return;
    const nextRole = (window.prompt("Role (member/coach/superadmin)", currentRole) ?? currentRole).trim();
    const nextVerified =
      (window.prompt("Verified? (true/false)", String(currentVerified)) ?? String(currentVerified)).toLowerCase() ===
      "true";

    updateUser.mutate(
      {
        id,
        data: {
          name: nextName,
          role: nextRole,
          isVerified: nextVerified,
        },
      },
      {
        onSuccess: () => toast.success("User updated"),
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
                      onClick={() => editUser(u.id, u.name, u.role, u.isVerified)}
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
    </DashboardLayout>
  );
}
