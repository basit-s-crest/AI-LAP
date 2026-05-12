"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/cards/StatsCard";
import { ActivityCardRow } from "@/components/cards/ActivityCard";
import { useActivityQuery } from "@/hooks/api/use-admin";
import { useOrganizationsQuery } from "@/hooks/api/use-organizations";
import { useAdminCoaches } from "@/hooks/admin/useAdminCoaches";
import { useAdminGroups } from "@/hooks/admin/useAdminGroups";
import { useAdminUsers } from "@/hooks/admin/useAdminUsers";

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SuperadminDashboardHome() {
  const { data: activity = [] } = useActivityQuery();
  const { data: orgs = [] } = useOrganizationsQuery();
  const { data: users = [] } = useAdminUsers();
  const { data: coaches = [] } = useAdminCoaches();
  const { data: groups = [] } = useAdminGroups();

  const bars = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - (29 - index));
      return date;
    });

    const counts = days.map((day) => {
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      return users.filter((user) => {
        const created = new Date(user.createdAt);
        return created >= day && created < next;
      }).length;
    });

    const max = Math.max(...counts, 1);
    return days.map((day, index) => ({
      date: day,
      v: counts[index],
      h: Math.max((counts[index] / max) * 100, counts[index] > 0 ? 8 : 2),
    }));
  }, [users]);

  const topGroups = useMemo(
    () => [...groups].sort((a, b) => b.postCount - a.postCount).slice(0, 5),
    [groups]
  );

  const verifiedUsers = users.filter((user) => user.isVerified).length;
  const activeCoaches = coaches.filter((coach) => coach.isActive).length;
  const totalMessages = users.reduce((total, user) => total + user.messageCount, 0);
  const pendingUsers = users.length - verifiedUsers;

  return (
    <div className="animate-fadeIn">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label="Total Users"
          value={String(users.length)}
          sub={`${verifiedUsers} verified`}
          accent="sage"
        />
        <StatsCard
          label="Active Coaches"
          value={String(activeCoaches)}
          sub={`${coaches.length} total`}
          accent="blue"
        />
        <StatsCard
          label="Messages"
          value={String(totalMessages)}
          sub="member messages"
          accent="gold"
        />
        <StatsCard
          label="Pending Users"
          value={String(pendingUsers)}
          sub="not verified"
          accent="red"
        />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-serif text-lg font-semibold">Platform Activity — 30 Days</h3>
            <div className="flex gap-2">
              {["7D", "30D", "90D"].map((t, i) => (
                <button
                  key={t}
                  type="button"
                  className={
                    i === 1
                      ? "rounded-md border border-sage px-2 py-1 text-[11.5px] font-semibold text-sage"
                      : "rounded-md border border-[rgba(60,50,40,0.12)] px-2 py-1 text-[11.5px] font-semibold text-mid"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-[110px] items-end gap-0.5">
            {bars.map((b) => (
              <div
                key={b.date.toISOString()}
                title={`${formatShortDate(b.date)}: ${b.v} new users`}
                className="flex-1 rounded-t bg-sage opacity-80"
                style={{ height: `${b.h}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-dim">
            {bars.filter((_, index) => index % 7 === 0 || index === bars.length - 1).map((bar) => (
              <span key={bar.date.toISOString()}>{formatShortDate(bar.date)}</span>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">Live Activity</h3>
          {activity.slice(0, 5).map((a, i) => (
            <ActivityCardRow key={i} {...a} />
          ))}
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
            Mood Distribution
          </div>
          {[
            ["😊 Great", 0.28, "#4E8C58"],
            ["🙂 Good", 0.35, "#7AB882"],
            ["😐 Okay", 0.22, "#B8832A"],
            ["😟 Low", 0.1, "#B35A38"],
            ["😔 Struggling", 0.05, "#C0392B"],
          ].map(([l, p, c]) => (
            <div key={String(l)} className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm">{l}</div>
                <div className="font-mono text-xs text-mid">{Math.round(Number(p) * 100)}%</div>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-[#EDE7DC]">
                <div
                  className="h-full rounded"
                  style={{ width: `${Number(p) * 100}%`, background: c as string }}
                />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
            Top Groups by Activity
          </div>
          {topGroups.map((g) => (
            <div key={g.id} className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{g.emoji}</span>
                <span className="text-sm font-semibold">{g.name}</span>
              </div>
              <span className="font-mono text-xs text-mid">{g.postCount} posts</span>
            </div>
          ))}
        </Card>
        <Card>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
            Client Orgs
          </div>
          {orgs.map((o) => (
            <div key={o.id} className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{o.name}</div>
                <div className="text-xs text-dim">{o.type}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs text-sage">{o.users}</div>
                <div className="text-xs text-dim">{o.plan}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
