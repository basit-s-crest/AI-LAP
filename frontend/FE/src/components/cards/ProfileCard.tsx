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
        "border-0 bg-sidebar p-8 text-center text-[#FDFAF5]",
        className
      )}
      variant="default"
    >
      <div className="mx-auto mb-3.5 flex h-[72px] w-[72px] items-center justify-center rounded-[18px] bg-sage text-[32px]">
        {emoji}
      </div>
      <div className="font-serif text-[22px] font-semibold">{name}</div>
      <div className="mb-[18px] text-xs text-white/40">{subtitle}</div>
      <div className="flex border-t border-white/10 pt-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn("flex-1", i < stats.length - 1 && "border-r border-white/10")}
          >
            <div className="font-serif text-[22px] font-extrabold">{s.value}</div>
            <div className="mt-0.5 text-[10px] text-white/40">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
