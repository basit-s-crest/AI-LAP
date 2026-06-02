"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { useOrgMembers } from "@/hooks/org/useOrgMembers";
import { Card } from "@/components/ui/Card";

export default function OrgMembersPage() {
  const { data: members = [], isPending, isError, error } = useOrgMembers();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  return (
    <DashboardLayout title="Members">
      {isError ? (
        <Card className="text-sm text-danger">{error.message || "Failed to load members"}</Card>
      ) : (
        <TableWrap>
          <TableToolbar title={`Members (${filtered.length})`}>
            <input
              className="w-64 rounded-lg border border-[rgba(60,50,40,0.15)] bg-white px-3 py-2 text-sm outline-none focus:border-[#4E8C58]"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
            />
          </TableToolbar>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Member", "Joined", "Sessions", "Last Active", "Avg Mood", "Status"].map((header) => (
                  <th
                    key={header}
                    className="border-b-[1.5px] border-line bg-[#EDE7DC] px-[22px] py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-dim"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid">
                    Loading members...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid">
                    No members yet. Members will appear here once they are added to your organization.
                  </td>
                </tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.id} className="group">
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <div className="font-semibold">{member.name}</div>
                      <div className="text-xs text-mid">{member.email}</div>
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {new Date(member.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {member.sessionCount}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {member.lastActiveAt 
                        ? new Date(member.lastActiveAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "—"}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {member.avgMood || "—"}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      <Badge variant={member.status === "active" ? "sage" : "dim"}>
                        {member.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      )}
    </DashboardLayout>
  );
}
