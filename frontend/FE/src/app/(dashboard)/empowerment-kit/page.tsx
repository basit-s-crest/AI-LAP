"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BaseModal } from "@/components/modals/BaseModal";
import resources from "@/mock/resources.json";

type VideoResource = {
  emoji: string;
  title: string;
  duration: string;
  background: string;
  tag: string;
  youtubeUrl: string;
};

function youtubeEmbedId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) return fromQuery;
      const parts = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = parts.indexOf("embed");
      if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];
    }
  } catch {
    return null;
  }
  return null;
}

export default function EmpowermentKitPage() {
  const vids = resources.videos as VideoResource[];
  const [activeVideo, setActiveVideo] = useState<VideoResource | null>(null);

  const activeEmbedId = activeVideo ? youtubeEmbedId(activeVideo.youtubeUrl) : null;

  return (
    <DashboardLayout title="Empowerment Kit">
      <div className="anim-up">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vids.map((v) => (
            <button
              key={v.title}
              type="button"
              onClick={() => setActiveVideo(v)}
              className="block w-full cursor-pointer overflow-hidden rounded-card border border-line bg-card text-left transition-all hover:-translate-y-1 hover:shadow-soft"
            >
              <div
                className="flex h-[110px] items-center justify-center text-[38px]"
                style={{ background: v.background }}
              >
                {v.emoji}
              </div>
              <div className="px-4 py-3.5">
                <Badge variant="dim" className="mb-1 text-[10px]">
                  {v.tag}
                </Badge>
                <div className="text-sm font-semibold">{v.title}</div>
                <div className="text-sm text-dim">▶ {v.duration}</div>
              </div>
            </button>
          ))}
        </div>

        <BaseModal
          open={!!activeVideo}
          onClose={() => setActiveVideo(null)}
          title={activeVideo?.title}
          panelClassName="max-w-[min(100vw-2rem,900px)] p-5 sm:p-6"
        >
          {activeVideo && activeEmbedId ? (
            <div className="overflow-hidden rounded-card border border-line bg-ink">
              <div className="relative aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${activeEmbedId}?autoplay=1`}
                  title={activeVideo.title}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          ) : activeVideo ? (
            <p className="text-sm text-mid">This video could not be loaded.</p>
          ) : null}
          {activeVideo && (
            <p className="mt-3 text-xs text-dim">
              {activeVideo.tag} · {activeVideo.duration}
            </p>
          )}
        </BaseModal>

        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">Crisis Resources</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(resources.crisis as { emoji: string; title: string; description: string; background: string }[]).map(
              (r) => (
                <Card key={r.title} variant="sm" className="border-0" style={{ background: r.background }}>
                  <div className="mb-2 text-[26px]">{r.emoji}</div>
                  <div className="mb-1 font-semibold">{r.title}</div>
                  <div className="text-sm text-mid">{r.description}</div>
                </Card>
              )
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
