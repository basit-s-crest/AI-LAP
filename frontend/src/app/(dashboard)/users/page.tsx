"use client";

import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DataTable } from "@/components/tables/DataTable";
import { StatsCard } from "@/components/cards/StatsCard";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { TableFilters } from "@/components/tables/TableFilters";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { PlatformUser } from "@/types/user";
import { useState } from "react";
import { useUsersQuery } from "@/hooks/api/use-users";

const col = createColumnHelper<PlatformUser>();

export default function AdminUsersPage() {
  const { data: data = [], isPending } = useUsersQuery();
  const [q, setQ] = useState("");
  const activeUsers = data.filter((user) => user.status === "active").length;
  const inactiveUsers = data.filter((user) => user.status === "inactive").length;
  const totalGroups = data.reduce((total, user) => total + user.groups, 0);
  const filtered = useMemo(
    () =>
      data.filter(
        (u) =>
          u.name.toLowerCase().includes(q.toLowerCase()) ||
          u.email.toLowerCase().includes(q.toLowerCase())
      ),
    [data, q]
  );

  const columns = useMemo(
    () => [
      col.accessor("name", {
        header: "User",
        cell: (info) => (
          <div>
            <div className="font-semibold">{info.getValue()}</div>
            <div className="text-xs text-dim">{info.row.original.tags.join(" · ")}</div>
          </div>
        ),
      }),
      col.accessor("joined", {
        header: "Joined",
        cell: (info) => (
          <span className="font-mono text-xs text-mid">{info.getValue()}</span>
        ),
      }),
      col.accessor("groups", { header: "Groups" }),
      col.accessor("sessions", { header: "Messages" }),
      col.accessor("mood", {
        header: "Avg Mood",
        cell: (info) => {
          const mood = info.getValue();
          const color =
            mood != null && mood >= 4
              ? "#4E8C58"
              : mood != null && mood <= 2
                ? "#C0392B"
                : "#B8832A";
          return (
            <span className="font-mono font-semibold" style={{ color }}>
              {mood ?? "—"}
            </span>
          );
        },
      }),
      col.accessor("status", {
        header: "Status",
        cell: (info) => {
          const s = info.getValue();
          return (
            <Badge variant={s === "flagged" ? "red" : s === "active" ? "sage" : "dim"}>
              {s}
            </Badge>
          );
        },
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" type="button">
              View
            </Button>
            <Button
              variant="ghost"
              size="xs"
              type="button"
              className={info.row.original.status === "flagged" ? "text-danger hover:text-danger" : ""}
            >
              Edit
            </Button>
          </div>
        ),
      }),
    ],
    []
  );

  return (
    <DashboardLayout title="User Management">
      <div className="animate-fadeIn">
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard label="Total Registered" value={String(data.length)} sub="from database" accent="sage" />
          <StatsCard label="Active" value={String(activeUsers)} sub="verified users" accent="blue" />
          <StatsCard label="Group Joins" value={String(totalGroups)} sub="active memberships" accent="gold" />
          <StatsCard label="Pending" value={String(inactiveUsers)} sub="not verified" accent="red" />
        </div>
        <TableWrap>
          <TableToolbar title={`All Users (${filtered.length})`}>
            <TableFilters searchPlaceholder="Search users..." value={q} onChange={setQ} />
          </TableToolbar>
          {isPending ? (
            <p className="px-[22px] py-8 text-center text-sm text-mid">Loading users…</p>
          ) : (
            <DataTable data={filtered} columns={columns} pageSize={8} />
          )}
        </TableWrap>
      </div>
    </DashboardLayout>
  );
}
