"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import resources from "@/mock/resources.json";

export default function EmpowermentKitPage() {
  const vids = resources.videos as {
    emoji: string;
    title: string;
    duration: string;
    background: string;
    tag: string;
  }[];

  return (
    <DashboardLayout title="Empowerment Kit">
      <div className="animate-fadeIn">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vids.map((v) => (
            <div
              key={v.title}
              className="cursor-pointer overflow-hidden rounded-card border border-line bg-card transition-all hover:-translate-y-1 hover:shadow-soft"
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
            </div>
          ))}
        </div>
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
