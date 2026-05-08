import { cn } from "@/lib/cn";

export type StatsAccent = "sage" | "gold" | "blue" | "red" | "terra";

const accentBar: Record<StatsAccent, string> = {
  sage: "after:bg-gradient-to-r after:from-sage after:to-sage-light",
  gold: "after:bg-gradient-to-r after:from-gold after:to-gold-light",
  blue: "after:bg-gradient-to-r after:from-blue after:to-blue-light",
  red: "after:bg-gradient-to-r after:from-danger after:to-danger-light",
  terra: "after:bg-gradient-to-r after:from-terra after:to-terra-light",
};

export function StatsCard({
  label,
  value,
  sub,
  trend,
  trendUp,
  accent = "sage",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  accent?: StatsAccent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border-[1.5px] border-line bg-card p-5",
        "after:pointer-events-none after:absolute after:left-0 after:right-0 after:top-0 after:h-[3px] after:rounded-t-card",
        accentBar[accent],
        className
      )}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-[1.2px] text-dim">{label}</div>
      <div className="font-serif text-4xl font-bold leading-none text-ink">{value}</div>
      {trend ? (
        <div
          className={cn(
            "mt-[7px] text-xs font-semibold",
            trendUp === true && "text-[#2E7D4F]",
            trendUp === false && "text-danger"
          )}
        >
          {trend}
        </div>
      ) : null}
      {sub && !trend ? <div className="mt-[7px] text-xs text-mid">{sub}</div> : null}
    </div>
  );
}
