"use client";

import { BaseModal } from "./BaseModal";
import { Button } from "@/components/ui/Button";

export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
}) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      panelClassName="max-w-[360px] text-center"
      showClose={false}
    >
      <div className="font-serif text-[22px] font-semibold text-ink">{title}</div>
      <p className="mt-3 text-sm text-mid">{message}</p>
      <div className="mt-6 flex gap-3">
        <Button variant="ghost" className="flex-1" type="button" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          className="flex-1"
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </BaseModal>
  );
}
