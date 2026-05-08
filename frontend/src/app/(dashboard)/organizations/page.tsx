"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/cards/StatsCard";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useOrganizationsQuery } from "@/hooks/api/use-organizations";

export default function AdminOrganizationsPage() {
  const { data: rows = [], isPending } = useOrganizationsQuery();
  return (
    <DashboardLayout title="Client Organizations">
      <div className="animate-fadeIn">
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard label="Total Partners" value="4" sub="Active contracts" accent="sage" />
          <StatsCard label="Total Members" value="1,714" trend="↑ 14 this week" trendUp accent="gold" />
          <StatsCard label="MRR" value="$23.9k" trend="↑ 8% MoM" trendUp accent="blue" />
          <StatsCard label="Active Coaches" value="19" sub="Across all orgs" accent="terra" />
        </div>
        <TableWrap>
          <TableToolbar title="Client Organizations">
            <Button size="sm" type="button">
              + Add Partner
            </Button>
          </TableToolbar>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {[
                  "Organization",
                  "Type",
                  "Plan",
                  "Users",
                  "Active Rate",
                  "Coaches",
                  "MRR",
                  "",
                ].map((h) => (
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
              ) : (
                rows.map((o) => (
                <tr key={o.id} className="group">
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <div className="font-semibold">{o.name}</div>
                    <div className="text-xs text-dim">{o.contact}</div>
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <Badge variant="dim">{o.type}</Badge>
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <Badge variant={o.plan === "Enterprise" ? "gold" : o.plan === "Pro" ? "blue" : "dim"}>
                      {o.plan}
                    </Badge>
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono font-semibold group-hover:bg-[#EDE7DC]">
                    {o.users}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 max-w-[80px] flex-1 overflow-hidden rounded bg-[#EDE7DC]">
                        <div
                          className="h-full rounded bg-sage"
                          style={{ width: `${Math.round((o.active / o.users) * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs">{Math.round((o.active / o.users) * 100)}%</span>
                    </div>
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    {o.coaches}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono font-semibold text-sage group-hover:bg-[#EDE7DC]">
                    {o.spend}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <Button variant="ghost" size="xs" type="button" className="mr-1">
                      Dashboard
                    </Button>
                    <Button variant="ghost" size="xs" type="button">
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
    </DashboardLayout>
  );
}
