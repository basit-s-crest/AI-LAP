"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "gold";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-sage text-white hover:bg-[#3E7248] hover:shadow-[0_3px_12px_rgba(78,140,88,0.3)]",
  outline:
    "bg-transparent text-sage border-[1.5px] border-sage hover:bg-sage-soft",
  ghost:
    "bg-transparent text-mid border-[1.5px] border-[rgba(60,50,40,0.12)] hover:bg-[#F0EBE1] hover:text-ink hover:border-[rgba(60,50,40,0.22)]",
  danger: "bg-danger text-white hover:bg-[#A0302A]",
  gold: "bg-gold text-white hover:opacity-95",
};

const sizes: Record<ButtonSize, string> = {
  xs: "px-2.5 py-1 text-[11.5px] rounded-md",
  sm: "px-3.5 py-1.5 text-xs rounded-[7px]",
  md: "px-5 py-2.5 text-[13.5px] rounded-[9px]",
  lg: "px-7 py-3.5 text-[15px] rounded-[9px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", fullWidth, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    />
  );
});
