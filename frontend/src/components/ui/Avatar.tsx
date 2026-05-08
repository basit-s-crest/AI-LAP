import { cn } from "@/lib/cn";

export function Avatar({
  label,
  className,
  style,
}: {
  label: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const initial = label.trim().charAt(0).toUpperCase() || "U";
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white",
        className
      )}
      style={style}
    >
      {initial}
    </div>
  );
}
