import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-card/60 px-6 py-14 text-center",
        className
      )}
    >
      <p className="font-serif text-lg font-semibold text-ink">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-mid">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
