"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useUsersQuery } from "@/hooks/api/use-users";

export default function OrgMembersPage() {
  const { data: users = [], isPending } = useUsersQuery();

  return (
    <DashboardLayout title="Member Management">
      <TableWrap className="animate-fadeIn">
        <TableToolbar title="Members (312)">
          <Input placeholder="Search members..." className="w-[220px]" />
        </TableToolbar>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Member", "Joined", "Sessions", "Last Active", "Avg Mood", "Status"].map((h) => (
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
                  Loading members…
                </td>
              </tr>
            ) : (
              users.map((u) => (
              <tr key={u.id} className="group">
                <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-dim">{u.email}</div>
                </td>
                <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono text-xs text-mid group-hover:bg-[#EDE7DC]">
                  {u.joined}
                </td>
                <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                  {u.sessions}
                </td>
                <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono text-xs text-mid group-hover:bg-[#EDE7DC]">
                  3d ago
                </td>
                <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                  <span className="font-mono font-semibold">{u.mood ?? "—"}</span>
                </td>
                <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                  <Badge variant={u.status === "flagged" ? "red" : u.status === "active" ? "sage" : "dim"}>
                    {u.status}
                  </Badge>
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
