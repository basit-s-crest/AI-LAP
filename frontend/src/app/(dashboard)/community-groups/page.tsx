"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GroupCard } from "@/components/cards/GroupCard";
import { Input } from "@/components/ui/Input";
import groupsData from "@/mock/groups.json";
import type { CommunityGroup } from "@/types/group";

export default function CommunityGroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<CommunityGroup[]>(
    () => JSON.parse(JSON.stringify(groupsData)) as CommunityGroup[]
  );
  const [q, setQ] = useState("");

  const joined = useMemo(() => groups.filter((g) => g.joined), [groups]);
  const discover = useMemo(() => groups.filter((g) => !g.joined), [groups]);

  const filter = (list: CommunityGroup[]) =>
    list.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));

  const toggle = (id: number) => {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, joined: !g.joined } : g)));
  };

  return (
    <DashboardLayout title="Community Groups">
      <div className="animate-fadeIn">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-dim">
              Your Communities
            </div>
            <p className="text-sm text-mid">Spaces curated for your journey</p>
          </div>
          <Input
            placeholder="Search groups..."
            className="w-[220px]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {filter(joined).length ? (
          <>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
              JOINED GROUPS
            </div>
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filter(joined).map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  onOpen={() => router.push(`/community-groups/${g.id}`)}
                  onToggleJoin={() => toggle(g.id)}
                />
              ))}
            </div>
          </>
        ) : null}
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
          DISCOVER GROUPS
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filter(discover).map((g) => (
            <GroupCard key={g.id} group={g} onToggleJoin={() => toggle(g.id)} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
