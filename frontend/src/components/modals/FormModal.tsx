"use client";

import { BaseModal } from "./BaseModal";
import { Button } from "@/components/ui/Button";

export function FormModal({
  open,
  onClose,
  title,
  children,
  submitLabel = "Save",
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  submitLabel?: string;
  onSubmit?: () => void;
}) {
  return (
    <BaseModal open={open} onClose={onClose} title={title}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
      >
        {children}
        <div className="mt-4 flex gap-3">
          <Button variant="ghost" type="button" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            {submitLabel}
          </Button>
        </div>
      </form>
    </BaseModal>
  );
}
