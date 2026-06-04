"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useGroup } from "@/hooks/groups/useGroup";
import { useCreatePost } from "@/hooks/groups/useCreatePost";
import { toast } from "sonner";

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [draft, setDraft] = useState("");

  const { data: group, isLoading } = useGroup(id);
  const createPost = useCreatePost(id);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    createPost.mutate(text, {
      onSuccess: () => {
        setDraft("");
        toast.success("Posted");
      },
      onError: (e: any) => {
        toast.error(e?.message || "Failed to post. Join the group first.");
      },
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Community">
        <div className="text-sm text-dim">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!group) {
    return (
      <DashboardLayout title="Community">
        <p className="text-mid">Group not found.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={group.name}>
      <div className="anim-up">
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => router.push("/community-groups")}
          >
            ← Back
          </Button>
          <span className="text-2xl">{group.emoji}</span>
          <div>
            <div className="font-serif text-[22px] font-semibold">{group.name}</div>
            <div className="text-sm text-mid">{group.members} members</div>
          </div>
        </div>

        <div className="mb-4 rounded-card border border-line bg-card p-5">
          <Textarea
            rows={3}
            placeholder="Share something with the community..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="mb-3"
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-dim">
              Be kind · Stay on topic · Support each other
            </div>
            <Button
              size="sm"
              type="button"
              onClick={submit}
              disabled={createPost.isPending}
            >
              {createPost.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>

        {group.posts.map((p) => (
          <div
            key={p.id}
            className="mb-3 anim-up rounded-xl border border-line bg-card p-[18px]"
          >
            <div className="mb-2.5 flex items-center gap-2.5">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-sage-tint text-[15px]">
                🌿
              </div>
              <div>
                <div className="text-[13.5px] font-bold">{p.author}</div>
                <div className="text-[11px] text-dim">
                  {new Date(p.time).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="mb-2.5 text-[13.5px] leading-relaxed text-ink">{p.body}</div>
            <div className="flex gap-3.5">
              <button type="button" className="text-[12.5px] font-semibold text-mid hover:text-sage">
                💬 {p.replyCount} replies
              </button>
              <button type="button" className="text-[12.5px] font-semibold text-mid hover:text-sage">
                🤍 {p.supportCount} Support
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
