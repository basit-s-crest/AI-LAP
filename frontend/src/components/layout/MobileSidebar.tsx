"use client";

import { Drawer } from "@/components/ui/Drawer";
import { RoleSidebar } from "./RoleSidebar";
import type { Role } from "@/types/role";

export function MobileSidebar({
  open,
  onClose,
  role,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  role: Role;
  userName: string;
}) {
  return (
    <Drawer open={open} onClose={onClose} side="left">
      <RoleSidebar
        variant="drawer"
        role={role}
        userName={userName}
        onSwitchRole={() => {
          onClose();
        }}
      />
    </Drawer>
  );
}
