import { cn } from "@/lib/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "sm" | "xs";
  hoverable?: boolean;
}

const paddings = {
  default: "rounded-card border-[1.5px] border-line p-[22px]",
  sm: "rounded-xl border-[1.5px] border-line p-4",
  xs: "rounded-[10px] border-[1.5px] border-line p-3",
};

export function Card({
  className,
  variant = "default",
  hoverable,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-card",
        paddings[variant],
        hoverable &&
          "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(60,50,40,0.2)] hover:shadow-soft",
        className
      )}
      {...props}
    />
  );
}
