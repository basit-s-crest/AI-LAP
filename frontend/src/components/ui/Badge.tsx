import { cn } from "@/lib/cn";

export type BadgeVariant = "sage" | "gold" | "red" | "blue" | "terra" | "dim";

const map: Record<BadgeVariant, string> = {
  sage: "bg-sage-tint text-sage",
  gold: "bg-gold-tint text-gold",
  red: "bg-danger-soft text-danger",
  blue: "bg-blue-tint text-blue",
  terra: "bg-terra-tint text-terra",
  dim: "border border-line bg-[#F0EBE1] text-mid",
};

export function Badge({
  className,
  variant = "dim",
  children,
}: {
  className?: string;
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11.5px] font-bold",
        map[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
