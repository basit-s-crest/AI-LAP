"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/cards/StatsCard";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const flags = [
  { user: "Jordan W.", group: "Healing in Community", content: "Post flagged for distress signals", time: "2 min ago", severity: "high" as const },
  { user: "Anonymous", group: "First-Gen Focus", content: "Possible rule violation — off-topic self-promotion", time: "1h ago", severity: "medium" as const },
  { user: "Alex K.", group: "Queer & Thriving", content: "Support ticket: app login issue", time: "3h ago", severity: "low" as const },
];

export default function ModerationPage() {
  return (
    <DashboardLayout title="Content Moderation">
      <div className="animate-fadeIn">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard label="High Priority" value="1" sub="Action required" accent="red" />
          <StatsCard label="Medium Priority" value="1" sub="Review when able" accent="gold" />
          <StatsCard label="Low Priority" value="1" sub="Monitor" accent="blue" />
        </div>
        <TableWrap>
          <TableToolbar title="Flagged Content (3)" />
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["User", "Group", "Issue", "Time", "Severity", "Action"].map((h) => (
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
              {flags.map((f) => (
                <tr key={`${f.user}-${f.group}-${f.time}`} className="group">
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-semibold group-hover:bg-[#EDE7DC]">
                    {f.user}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-mid group-hover:bg-[#EDE7DC]">
                    {f.group}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm group-hover:bg-[#EDE7DC]">
                    {f.content}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono text-xs text-dim group-hover:bg-[#EDE7DC]">
                    {f.time}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <Badge
                      variant={
                        f.severity === "high" ? "red" : f.severity === "medium" ? "gold" : "blue"
                      }
                    >
                      {f.severity}
                    </Badge>
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <Button variant="ghost" size="xs" type="button" className="mr-1">
                      Resolve
                    </Button>
                    <Button variant="ghost" size="xs" type="button" className="text-danger">
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </DashboardLayout>
  );
}
