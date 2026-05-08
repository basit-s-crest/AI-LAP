import { Badge } from "@/components/ui/Badge";

export function ActivityCardRow({
  icon,
  bg,
  html,
  time,
  type,
}: {
  icon: string;
  bg: string;
  html: string;
  time: string;
  type: string;
}) {
  const badgeVariant =
    type === "alert" ? "red" : type === "moderation" ? "gold" : ("dim" as const);
  return (
    <div className="flex gap-3 border-b border-[rgba(60,50,40,0.08)] py-[11px] last:border-b-0">
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] text-[15px]"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] leading-relaxed text-mid [&_strong]:font-semibold [&_strong]:text-ink"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="mt-0.5 font-mono text-[11px] text-dim">{time}</div>
      </div>
      <Badge variant={badgeVariant} className="h-fit shrink-0 text-[10px]">
        {type}
      </Badge>
    </div>
  );
}
