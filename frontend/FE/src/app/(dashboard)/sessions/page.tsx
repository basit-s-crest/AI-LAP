"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { StatsCard } from "@/components/cards/StatsCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";

interface SessionRow {
  id: string;
  memberName: string;
  date: string;       // ISO string from API
  duration: number;
  type: string;
  status: string;
}

export default function CoachSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<SessionRow[]>("/api/sessions/coach")
      .then(({ data }) => setSessions(data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  // Derived stats
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisWeek = sessions.filter((s) => new Date(s.date) >= weekStart).length;
  const thisMonth = sessions.filter((s) => new Date(s.date) >= monthStart).length;
  const totalHours = sessions.reduce((acc, s) => acc + s.duration / 60, 0);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardLayout title="Sessions">
      <div className="animate-fadeIn">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard label="This Week" value={String(thisWeek)} sub="sessions" accent="blue" />
          <StatsCard label="This Month" value={String(thisMonth)} sub="sessions" accent="sage" />
          <StatsCard label="Total Hours" value={totalHours.toFixed(1)} sub="this month" accent="gold" />
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid">
                    Loading sessions…
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-[22px] py-8 text-center text-sm text-mid">
                    No sessions yet.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="group">
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-mono text-sm group-hover:bg-[#EDE7DC]">
                      {formatDate(s.date)}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] font-semibold group-hover:bg-[#EDE7DC]">
                      {s.memberName}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] text-sm text-mid group-hover:bg-[#EDE7DC]">
                      {s.type}
                    </td>
                    <td className="border-b border-[rgba(60,50,40,0.08)] px-[22px] py-[13px] group-hover:bg-[#EDE7DC]">
                      {s.duration} min
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
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </DashboardLayout>
  );
}
