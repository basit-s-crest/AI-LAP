"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/cards/StatsCard";
import { cn } from "@/lib/cn";
import api from "@/lib/api";
import type { ConversationSummary } from "@/types/coachMessage";

interface CoachMember {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  isVerified: boolean;
  createdAt: string;
  assignedAt: string;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      className={cn(
        "relative h-[22px] w-[38px] cursor-pointer rounded-[11px] transition-colors",
        on ? "bg-sage" : "border-[1.5px] border-[rgba(60,50,40,0.2)] bg-[#EDE7DC]"
      )}
    >
      <div
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-[left]",
          on ? "left-[19px]" : "left-[3px]"
        )}
      />
    </div>
  );
}

export function CoachDashboardHome() {
  const [onDemand, setOnDemandLocal] = useState(false);

  // Load initial on-demand status from the API
  useEffect(() => {
    api
      .get<{ onDemand: boolean }>("/api/coach/on-demand")
      .then(({ data }) => setOnDemandLocal(data.onDemand))
      .catch(() => { /* silently ignore — default stays false */ });
  }, []);

  const handleToggle = async () => {
    const next = !onDemand;
    try {
      const { data } = await api.patch<{ onDemand: boolean }>("/api/coach/on-demand", {
        onDemand: next,
      });
      setOnDemandLocal(data.onDemand);
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["coach", "members"],
    queryFn: async (): Promise<CoachMember[]> => {
      const { data } = await api.get<{ members: CoachMember[] }>("/api/coach/members");
      return data.members;
    },
  });
  const { data: conversations = [] } = useQuery({
    queryKey: ["coach-conversations"],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data } = await api.get<ConversationSummary[]>("/api/coach-messages");
      return data;
    },
  });

  const unreadCount = conversations.reduce((total, item) => total + item.unreadCount, 0);
  const recentConversations = [...conversations]
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    .slice(0, 4);

  return (
    <div className="animate-fadeIn">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label="Active Clients"
          value={String(members.length)}
          sub="assigned to you"
          accent="blue"
        />
        <StatsCard
          label="Message Threads"
          value={String(conversations.length)}
          sub="client conversations"
          accent="sage"
        />
        <StatsCard
          label="Unread Messages"
          value={String(unreadCount)}
          sub="need response"
          accent="gold"
        />
        <StatsCard
          label="New Clients"
          value={String(
            members.filter(
              (member) =>
                new Date(member.assignedAt).getTime() >
                Date.now() - 30 * 24 * 60 * 60 * 1000
            ).length
          )}
          sub="last 30 days"
          accent="red"
        />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">Assigned Clients</h3>
          {membersLoading ? (
            <div className="text-sm text-dim">Loading clients...</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-dim">No clients assigned yet.</div>
          ) : (
            members.slice(0, 5).map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between border-b border-[rgba(60,50,40,0.08)] py-3 last:border-0"
              >
                <div>
                  <div className="text-sm font-semibold">{member.name}</div>
                  <div className="text-xs text-dim">{member.email}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-mid">
                    {formatDate(member.assignedAt)}
                  </div>
                  <div className="text-xs text-dim">
                    {member.isVerified ? "Verified" : "Pending"}
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-serif text-lg font-semibold">Recent Client Messages</h3>
            {recentConversations.length === 0 ? (
              <div className="text-sm text-dim">No client messages yet.</div>
            ) : (
              recentConversations.map((conversation) => (
                <div
                  key={conversation.partnerId}
                  className={cn(
                    "mb-3 flex gap-3 rounded-[10px] p-3 last:mb-0",
                    conversation.unreadCount > 0 ? "bg-danger-soft" : "bg-sage-tint"
                  )}
                >
                  <span className="text-lg">{conversation.unreadCount > 0 ? "!" : "✓"}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{conversation.partnerName}</div>
                    <div className="truncate text-xs text-mid">{conversation.lastMessage}</div>
                  </div>
                </div>
              ))
            )}
          </Card>
          <Card>
            <h3 className="mb-2 font-serif text-lg font-semibold">On-Demand Status</h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Available for sessions</div>
                <div className="text-xs text-dim">Members can reach you now</div>
              </div>
              <button type="button" onClick={handleToggle}>
                <Toggle on={onDemand} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
