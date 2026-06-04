"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";

const items = ["🌿", "🌱", "🌍", "🌈", "✊🏾", "🧘", "📚", "💚", "🦋", "🕊️", "🌻", "🌙"];

export default function MediaPage() {
  return (
    <DashboardLayout title="Media & Photos">
      <div className="anim-up">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="serif text-lg font-semibold text-ink">Media Library</h3>
          <Button size="sm" type="button">
            + Upload Photo
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {items.map((e) => (
            <div
              key={e}
              className="flex aspect-square cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] border-line bg-[var(--bg-surface-2)] text-[32px] transition-colors hover:border-sage"
            >
              {e}
            </div>
          ))}
          <div className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-2 border-dashed border-line text-xs text-dim transition-colors hover:border-sage hover:text-sage bg-card">
            <span className="text-2xl">+</span>
            Upload
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
