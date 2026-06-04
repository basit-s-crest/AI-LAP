import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export function ProfileCard({
  emoji,
  name,
  subtitle,
  stats,
  className,
}: {
  emoji: string;
  name: string;
  subtitle: string;
  stats: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "p-8 text-center text-ink",
        className
      )}
      variant="default"
    >
      <div className="mx-auto mb-3.5 flex h-[72px] w-[72px] items-center justify-center rounded-[18px] bg-sage/20 border border-sage/30 text-[32px]">
        {emoji}
      </div>
      <div className="font-serif text-[22px] font-semibold">{name}</div>
      <div className="mb-[18px] text-xs text-dim">{subtitle}</div>
      <div className="flex border-t border-line pt-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn("flex-1", i < stats.length - 1 && "border-r border-line")}
          >
            <div className="font-serif text-[22px] font-extrabold">{s.value}</div>
            <div className="mt-0.5 text-[10px] text-dim">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
