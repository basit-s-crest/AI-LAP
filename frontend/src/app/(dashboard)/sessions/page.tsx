"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { StatsCard } from "@/components/cards/StatsCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import sessions from "@/mock/sessions.json";
import type { CoachingSession } from "@/types/session";

export default function CoachSessionsPage() {
  const rows = sessions as CoachingSession[];
  return (
    <DashboardLayout title="Sessions">
      <div className="animate-fadeIn">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard label="This Week" value="8" sub="sessions" accent="blue" />
          <StatsCard label="This Month" value="34" sub="sessions" accent="sage" />
          <StatsCard label="Total Hours" value="28.5" sub="this month" accent="gold" />
        </div>
        <TableWrap>
          <TableToolbar title="Session History" />
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Date & Time", "Client", "Type", "Duration", "Status", ""].map((h) => (
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
              {rows.map((s) => (
                <tr key={s.id} className="group">
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono text-sm group-hover:bg-[#EDE7DC]">
                    {s.date}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-semibold group-hover:bg-[#EDE7DC]">
                    {s.client}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-mid group-hover:bg-[#EDE7DC]">
                    {s.type}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    {s.duration}
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    <Badge variant={s.status === "upcoming" ? "blue" : "sage"}>{s.status}</Badge>
                  </td>
                  <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                    {s.status === "completed" ? (
                      <Button variant="ghost" size="xs" type="button">
                        View Notes
                      </Button>
                    ) : (
                      <Button size="xs" type="button">
                        Start
                      </Button>
                    )}
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
