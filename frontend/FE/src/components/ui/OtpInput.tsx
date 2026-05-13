"use client";

import { useRef, KeyboardEvent, ClipboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function OtpInput({ length = 6, value, onChange, className }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  const setAt = (index: number, char: string) => {
    const next = digits.map((c, i) => (i === index ? char : c === " " ? "" : c)).join("");
    onChange(next.replace(/\s/g, ""));
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(text);
  };

  return (
    <div className={cn("flex justify-center gap-2", className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          className="h-12 w-10 rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card text-center font-mono text-lg outline-none focus:border-sage"
          value={digits[i]?.trim() ?? ""}
          onPaste={handlePaste}
          onChange={(e) => {
            const c = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, c);
            if (c && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      ))}
    </div>
  );
}
