"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import resources from "@/mock/resources.json";

export default function ResourcesPage() {
  const links = resources.links as { title: string; description: string }[];
  return (
    <DashboardLayout title="Resources">
      <div className="animate-fadeIn">
        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="border-0 bg-danger-soft">
            <div className="mb-3 text-4xl">🆘</div>
            <h3 className="mb-1.5 font-serif text-lg font-semibold">Crisis Support</h3>
            <p className="mb-4 text-sm text-mid">
              If you&apos;re in immediate danger or experiencing a mental health crisis, reach out now.
            </p>
            <Button variant="danger" type="button">
              Call 988 Now
            </Button>
          </Card>
          <Card className="border-0 bg-blue-tint">
            <div className="mb-3 text-4xl">💬</div>
            <h3 className="mb-1.5 font-serif text-lg font-semibold">Text Support</h3>
            <p className="mb-4 text-sm text-mid">
              Text-based crisis counseling, available 24/7. No phone call required.
            </p>
            <Button type="button">Text HOME to 741741</Button>
          </Card>
        </div>
        <Card>
          <h3 className="mb-4 font-serif text-lg font-semibold">Helpful Links</h3>
          {links.map((r) => (
            <div
              key={r.title}
              className="flex items-center justify-between border-b border-[rgba(60,50,40,0.08)] py-3 last:border-b-0"
            >
              <div>
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-sm text-dim">{r.description}</div>
              </div>
              <span className="text-lg font-bold text-sage">→</span>
            </div>
          ))}
        </Card>
      </div>
    </DashboardLayout>
  );
}
