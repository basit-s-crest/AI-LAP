"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import groupsData from "@/mock/groups.json";
import postsSeed from "@/mock/group-posts.json";
import type { CommunityGroup, GroupPost } from "@/types/group";
import { toast } from "sonner";

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const group = (groupsData as CommunityGroup[]).find((g) => g.id === id);
  const [posts, setPosts] = useState<GroupPost[]>(
    () => JSON.parse(JSON.stringify(postsSeed)) as GroupPost[]
  );
  const [draft, setDraft] = useState("");

  const header = useMemo(() => {
    if (!group) return null;
    return (
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={() => router.push("/community-groups")}>
          ← Back
        </Button>
        <span className="text-2xl">{group.emoji}</span>
        <div>
          <div className="font-serif text-[22px] font-semibold">{group.name}</div>
          <div className="text-sm text-mid">{group.members} members</div>
        </div>
      </div>
    );
  }, [group, router]);

  if (!group) {
    return (
      <DashboardLayout title="Community">
        <p className="text-mid">Group not found.</p>
      </DashboardLayout>
    );
  }

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setPosts([
      {
        id: Date.now(),
        author: "You",
        emoji: "🌿",
        time: "Just now",
        body: text,
        replies: 0,
      },
      ...posts,
    ]);
    setDraft("");
    toast.success("Posted");
  };

  return (
    <DashboardLayout title={group.name}>
      <div className="animate-fadeIn">
        {header}
        <div className="mb-4 rounded-card border border-line bg-card p-5">
          <Textarea
            rows={3}
            placeholder="Share something with the community..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mb-3"
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-dim">Be kind · Stay on topic · Support each other</div>
            <Button size="sm" type="button" onClick={submit}>
              Post
            </Button>
          </div>
        </div>
        {posts.map((p) => (
          <div key={p.id} className="mb-3 animate-fadeIn rounded-xl border border-line bg-card p-[18px]">
            <div className="mb-2.5 flex items-center gap-2.5">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-sage-tint text-[15px]">
                {p.emoji}
              </div>
              <div>
                <div className="text-[13.5px] font-bold">{p.author}</div>
                <div className="text-[11px] text-dim">{p.time}</div>
              </div>
            </div>
            <div className="mb-2.5 text-[13.5px] leading-relaxed text-ink">{p.body}</div>
            <div className="flex gap-3.5">
              <button type="button" className="text-[12.5px] font-semibold text-mid hover:text-sage">
                💬 {p.replies} replies
              </button>
              <button type="button" className="text-[12.5px] font-semibold text-mid hover:text-sage">
                🤍 Support
              </button>
              <button type="button" className="text-[12.5px] font-semibold text-mid hover:text-sage">
                🔖 Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
