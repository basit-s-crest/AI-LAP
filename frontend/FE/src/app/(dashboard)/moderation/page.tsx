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
      <div className="anim-up">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard label="High Priority" value="1" sub="Action required" accent="rose" />
          <StatsCard label="Medium Priority" value="1" sub="Review when able" accent="amber" />
          <StatsCard label="Low Priority" value="1" sub="Monitor" accent="teal" />
        </div>
        <TableWrap>
          <TableToolbar title="Flagged Content (3)" />
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["User", "Group", "Issue", "Time", "Severity", "Action"].map((h) => (
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
              {flags.map((f) => (
                <tr key={`${f.user}-${f.group}-${f.time}`} className="group text-ink">
                  <td className="border-b border-line px-[22px] py-[13px] font-semibold group-hover:bg-[var(--bg-surface-2)]">
                    {f.user}
                  </td>
                  <td className="border-b border-line px-[22px] py-[13px] text-sm text-mid group-hover:bg-[var(--bg-surface-2)]">
                    {f.group}
                  </td>
                  <td className="border-b border-line px-[22px] py-[13px] text-sm group-hover:bg-[var(--bg-surface-2)]">
                    {f.content}
                  </td>
                  <td className="border-b border-line px-[22px] py-[13px] font-mono text-xs text-dim group-hover:bg-[var(--bg-surface-2)]">
                    {f.time}
                  </td>
                  <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                    <Badge
                      variant={
                        f.severity === "high" ? "red" : f.severity === "medium" ? "gold" : "blue"
                      }
                    >
                      {f.severity}
                    </Badge>
                  </td>
                  <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
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
