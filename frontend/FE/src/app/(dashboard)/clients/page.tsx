"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TableWrap } from "@/components/ui/Table";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";
import type { ConversationSummary } from "@/types/coachMessage";

function formatLastContact(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function CoachClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const {
    data: conversations = [],
    isLoading,
    isError,
  } = useQuery<ConversationSummary[]>({
    queryKey: ["coach-conversations"],
    queryFn: async () => {
      const { data } = await api.get<ConversationSummary[]>("/api/coach-messages");
      return data;
    },
  });

  const clients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return conversations
      .filter((client) => {
        if (!query) return true;
        return (
          client.partnerName.toLowerCase().includes(query) ||
          client.lastMessage.toLowerCase().includes(query)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
  }, [conversations, search]);

  return (
    <DashboardLayout title="My Clients">
      <TableWrap className="anim-up">
        <TableToolbar title={`My Clients (${isLoading ? "..." : clients.length})`}>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search clients..."
            className="w-[200px]"
          />
        </TableToolbar>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Client", "Last Message", "Last Contact", "Unread", "Status", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="border-b-[1.5px] border-line bg-[var(--bg-surface-2)] px-[22px] py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-dim"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="border-b border-line px-[22px] py-8 text-center text-sm text-dim text-ink"
                >
                  Loading clients...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td
                  colSpan={6}
                  className="border-b border-line px-[22px] py-8 text-center text-sm text-danger"
                >
                  Unable to load clients from coach messages.
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="border-b border-line px-[22px] py-8 text-center text-sm text-dim text-ink"
                >
                  No clients have messaged this coach yet.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.partnerId} className="group text-ink">
                  <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-teal-light text-sm font-bold text-teal">
                        {getInitial(client.partnerName)}
                      </div>
                      <div>
                        <div className="font-semibold">{client.partnerName}</div>
                        <div className="font-mono text-[11px] text-dim">
                          User ID: {client.partnerId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[320px] truncate border-b border-line px-[22px] py-[13px] text-sm text-mid group-hover:bg-[var(--bg-surface-2)]">
                    {client.lastMessage}
                  </td>
                  <td className="border-b border-line px-[22px] py-[13px] font-mono text-xs text-mid group-hover:bg-[var(--bg-surface-2)]">
                    {formatLastContact(client.lastMessageAt)}
                  </td>
                  <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                    <Badge variant={client.unreadCount > 0 ? "terra" : "dim"}>
                      {client.unreadCount}
                    </Badge>
                  </td>
                  <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                    <Badge variant={client.unreadCount > 0 ? "gold" : "sage"}>
                      {client.unreadCount > 0 ? "New message" : "Active"}
                    </Badge>
                  </td>
                  <td className="border-b border-line px-[22px] py-[13px] group-hover:bg-[var(--bg-surface-2)]">
                    <Button size="xs" type="button" onClick={() => router.push("/messages")}>
                      Message
                    </Button>
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
