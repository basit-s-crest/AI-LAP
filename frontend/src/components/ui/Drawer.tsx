"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { cn } from "@/lib/cn";

export function Drawer({
  open,
  onClose,
  side = "left",
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[500]">
      <DialogBackdrop className="fixed inset-0 bg-[rgba(30,26,22,0.45)]" />
      <div className="fixed inset-0 flex">
        <DialogPanel
          className={cn(
            "h-full w-[min(100%,320px)] bg-sidebar p-4 text-white shadow-xl transition data-[closed]:opacity-0",
            side === "left" ? "mr-auto data-[closed]:-translate-x-4" : "ml-auto data-[closed]:translate-x-4",
            className
          )}
        >
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
