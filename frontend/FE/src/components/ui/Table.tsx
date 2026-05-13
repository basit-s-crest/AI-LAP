import { cn } from "@/lib/cn";

export function TableWrap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border-[1.5px] border-line bg-card",
        className
      )}
    >
      {children}
    </div>
  );
}
