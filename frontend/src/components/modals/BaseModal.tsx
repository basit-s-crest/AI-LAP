"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  panelClassName?: string;
  showClose?: boolean;
}

export function BaseModal({
  open,
  onClose,
  title,
  children,
  className,
  panelClassName,
  showClose = true,
}: BaseModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className={cn("relative z-[500]", className)}>
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[rgba(30,26,22,0.55)] backdrop-blur-[3px] data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className={cn(
            "max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-modal border-[1.5px] border-line bg-card p-7 shadow-soft data-[closed]:scale-95 data-[closed]:opacity-0",
            "animate-slideUp",
            panelClassName
          )}
        >
          {(title || showClose) && (
            <div className="mb-4 flex items-start justify-between gap-3">
              {title ? (
                <DialogTitle className="font-serif text-[22px] font-semibold text-ink">
                  {title}
                </DialogTitle>
              ) : (
                <span />
              )}
              {showClose ? (
                <button
                  type="button"
                  className="rounded-md border border-line px-2 py-1 text-mid hover:text-ink"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          )}
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
