import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export function ResourceCard({
  emoji,
  title,
  description,
  background,
  className,
}: {
  emoji: string;
  title: string;
  description: string;
  background?: string;
  className?: string;
}) {
  return (
    <Card variant="sm" className={cn("border-0", className)} style={{ background }}>
      <div className="mb-2 text-[26px]">{emoji}</div>
      <div className="mb-1 text-sm font-semibold">{title}</div>
      <div className="text-sm text-mid">{description}</div>
    </Card>
  );
}
