import { cn } from "@/lib/cn";

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-mid",
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}
