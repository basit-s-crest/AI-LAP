"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useUsersQuery } from "@/hooks/api/use-users";

export default function OrgMembersPage() {
  const { data: users = [], isPending } = useUsersQuery();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [q, users]);

  return (
    <DashboardLayout title="Member Management">
      <TableWrap className="anim-up">
        <TableToolbar title={`Members (${filtered.length})`}>
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search members..."
            className="w-[220px]"
          />
        </TableToolbar>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Member", "Joined", "Groups", "Messages", "Avg Mood", "Status"].map((h) => (
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
                  Loading members…
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
              <tr key={u.id} className="group text-ink">
                <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-dim">{u.email}</div>
                </td>
                <td className="border-b border-line px-[22px] py-[13px] font-mono text-xs text-mid group-hover:bg-[var(--bg-surface-2)]">
                  {u.joined}
                </td>
                <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                  {u.groups}
                </td>
                <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                  {u.sessions}
                </td>
                <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                  <span className="font-mono font-semibold">{u.mood ?? "—"}</span>
                </td>
                <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
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
