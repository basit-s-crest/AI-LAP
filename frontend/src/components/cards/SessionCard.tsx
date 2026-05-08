import { Badge } from "@/components/ui/Badge";
import type { SessionStatus } from "@/types/session";
import { cn } from "@/lib/cn";

const statusVariant = (s: SessionStatus): "sage" | "gold" | "blue" | "dim" => {
  if (s === "confirmed" || s === "completed") return "sage";
  if (s === "pending") return "gold";
  if (s === "upcoming" || s === "open") return "blue";
  return "dim";
};

export function SessionCardRow({
  time,
  name,
  type,
  status,
}: {
  time: string;
  name: string;
  type: string;
  status: SessionStatus;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[rgba(60,50,40,0.08)] py-[11px] last:border-b-0">
      <div className="w-[72px] font-mono text-sm text-mid">{time}</div>
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">{name}</div>
        <div className="text-xs text-dim">{type}</div>
      </div>
      <Badge variant={statusVariant(status)}>{status}</Badge>
    </div>
  );
}
