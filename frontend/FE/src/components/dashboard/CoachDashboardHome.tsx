"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
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

  // Count members assigned in the last 30 days
  const newMembersCount = members.filter(
    (member) =>
      new Date(member.assignedAt).getTime() >
      Date.now() - 30 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <div className="flex flex-col gap-6 anim-up">
      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Clients */}
        <div className="stat-card sc-teal flex flex-col justify-between min-h-[140px] anim-up" style={{ animationDelay: "0s" }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="stat-label">Active Clients</div>
              <div className="stat-value">{members.length}</div>
            </div>
            <div className="stat-icon" style={{ background: "var(--teal-light)", borderColor: "var(--border)" }}>👥</div>
          </div>
          <div className="stat-trend trend-up flex items-center gap-1">📈 Active</div>
        </div>

        {/* Message Threads */}
        <div className="stat-card sc-sage flex flex-col justify-between min-h-[140px] anim-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="stat-label">Message Threads</div>
              <div className="stat-value">{conversations.length}</div>
            </div>
            <div className="stat-icon" style={{ background: "var(--sage-light)", borderColor: "var(--border)" }}>💬</div>
          </div>
          <div className="stat-trend trend-up flex items-center gap-1">💬 Client chats</div>
        </div>

        {/* Unread Messages */}
        <div className="stat-card sc-amber flex flex-col justify-between min-h-[140px] anim-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="stat-label">Unread Messages</div>
              <div className="stat-value">{unreadCount}</div>
            </div>
            <div className="stat-icon" style={{ background: "var(--amber-light)", borderColor: "var(--border)" }}>🔔</div>
          </div>
          <div className="stat-trend trend-up flex items-center gap-1" style={{ color: unreadCount > 0 ? "var(--amber)" : "var(--sage)" }}>
            {unreadCount > 0 ? "⚠️ Action needed" : "✓ Caught up"}
          </div>
        </div>

        {/* New Clients */}
        <div className="stat-card sc-rose flex flex-col justify-between min-h-[140px] anim-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="stat-label">New Clients</div>
              <div className="stat-value">{newMembersCount}</div>
            </div>
            <div className="stat-icon" style={{ background: "var(--rose-light)", borderColor: "var(--border)" }}>🆕</div>
          </div>
          <div className="stat-trend trend-up flex items-center gap-1" style={{ color: "var(--rose)" }}>🌱 Last 30 days</div>
        </div>
      </div>

      {/* Main Grid: Left Column (Clients) & Right Column (Actions, Messages, Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        
        {/* Left Column: Assigned Clients Table */}
        <div className="card anim-up" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface-2)" }}>
            <div className="serif text-base text-ink mb-0">Assigned Clients</div>
            <span className="badge b-dim" style={{ fontSize: "11px", padding: "3px 10px", fontWeight: 600 }}>{members.length} Total</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface-2)" }}>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-ghost)" }}>Name</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-ghost)" }}>Assigned Date</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-ghost)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "20px", textAlign: "center", fontSize: "13.5px", color: "var(--ink-soft)" }}>
                      Loading clients...
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "20px", textAlign: "center", fontSize: "13.5px", color: "var(--ink-soft)" }}>
                      No clients assigned yet.
                    </td>
                  </tr>
                ) : (
                  members.slice(0, 5).map((member) => (
                    <tr key={member.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ink)" }}>{member.name}</div>
                        <div style={{ fontSize: "11.5px", color: "var(--ink-ghost)", marginTop: "2px" }}>{member.email}</div>
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: "13px", color: "var(--ink-soft)" }}>
                        {formatDate(member.assignedAt)}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span className={cn("badge", member.isVerified ? "b-sage" : "b-dim")} style={{ fontSize: "10px", padding: "3px 8px", fontWeight: 700, textTransform: "uppercase" }}>
                          {member.isVerified ? "Verified" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Actions, Messages, Status */}
        <div className="flex flex-col gap-6">
          
          {/* Quick Actions */}
          <div className="card anim-up" style={{ padding: "20px" }}>
            <div className="section-label" style={{ marginBottom: "12px" }}>Quick Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link
                href="/messages"
                className="btn btn-outline btn-sm w-full"
                style={{ padding: "10px", fontSize: "13px", borderRadius: "var(--r-sm)", fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span>💬 View Messages</span>
                {unreadCount > 0 && (
                  <span className="badge b-rose" style={{ fontSize: "9.5px", padding: "2px 6px", marginLeft: "auto" }}>{unreadCount}</span>
                )}
              </Link>
              <Link
                href="/availability"
                className="btn btn-outline btn-sm w-full"
                style={{ padding: "10px", fontSize: "13px", borderRadius: "var(--r-sm)", fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span>📅 Manage Schedule</span>
              </Link>
              <Link
                href="/notes"
                className="btn btn-outline btn-sm w-full"
                style={{ padding: "10px", fontSize: "13px", borderRadius: "var(--r-sm)", fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span>📝 Write Session Notes</span>
              </Link>
            </div>
          </div>

          {/* Recent Client Messages (Attention Alert Style) */}
          <div className="card anim-up" style={{ padding: "20px" }}>
            <div className="section-label" style={{ marginBottom: "12px" }}>Recent Client Messages</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {recentConversations.length === 0 ? (
                <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>No client messages yet.</div>
              ) : (
                recentConversations.map((conversation, idx) => {
                  const hasUnread = conversation.unreadCount > 0;
                  const icon = hasUnread ? "⚠️" : "💬";
                  const iconColor = hasUnread ? "var(--rose)" : "var(--sage)";
                  const iconBg = hasUnread ? "var(--rose-light)" : "var(--sage-light)";
                  const iconBorder = hasUnread ? "var(--rose-mid)" : "var(--sage-mid)";
                  const trendColor = hasUnread ? "var(--rose)" : "var(--ink-soft)";
                  
                  return (
                    <div
                      key={conversation.partnerId}
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "start",
                        paddingBottom: idx === recentConversations.length - 1 ? 0 : "12px",
                        borderBottom: idx === recentConversations.length - 1 ? "none" : "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "8px",
                          background: iconBg,
                          border: `1px solid ${iconBorder}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                          color: iconColor,
                          flexShrink: 0,
                        }}
                      >
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ink)" }}>
                          {conversation.partnerName}
                        </div>
                        <div style={{ fontSize: "11.5px", color: trendColor, fontWeight: 600, marginTop: "2px" }}>
                          {hasUnread ? `${conversation.unreadCount} unread message${conversation.unreadCount > 1 ? "s" : ""}` : "No unread messages"}
                        </div>
                        <div className="truncate" style={{ fontSize: "11px", color: "var(--ink-ghost)", marginTop: "4px" }}>
                          {conversation.lastMessage}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* On-Demand Status */}
          <div className="card anim-up" style={{ padding: "20px" }}>
            <div className="section-label" style={{ marginBottom: "12px" }}>On-Demand Status</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ink)" }}>Available for sessions</div>
                <div style={{ fontSize: "11.5px", color: "var(--ink-soft)", marginTop: "2px" }}>Members can reach you now</div>
              </div>
              <div className={cn("toggle", onDemand ? "on" : "off")} onClick={handleToggle} style={{ cursor: "pointer" }}>
                <div className="toggle-knob" />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
