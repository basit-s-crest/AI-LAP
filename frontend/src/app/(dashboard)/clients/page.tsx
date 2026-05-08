"use client";

import { useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useUsersQuery } from "@/hooks/api/use-users";

export default function CoachClientsPage() {
  const { data: allUsers = [] } = useUsersQuery();
  const users = useMemo(() => allUsers.slice(0, 4), [allUsers]);

  return (
    <DashboardLayout title="My Clients">
      <TableWrap className="animate-fadeIn">
        <TableToolbar title="My Clients (18)">
          <Input placeholder="Search clients..." className="w-[200px]" />
        </TableToolbar>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Client", "Sessions", "Last Session", "Avg Mood", "PHQ Score", "Status", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="border-b-[1.5px] border-line bg-[#EDE7DC] px-[22px] py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-dim"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="group">
                <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-dim">{u.tags.join(" · ")}</div>
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
                  <Badge variant="dim">7.1</Badge>
                </td>
                <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                  <Badge variant={u.status === "flagged" ? "red" : "sage"}>{u.status}</Badge>
                </td>
                <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                  <Button variant="ghost" size="xs" type="button" className="mr-1">
                    Notes
                  </Button>
                  <Button size="xs" type="button">
                    Message
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </DashboardLayout>
  );
}
