"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSwitchRoleMutation } from "@/hooks/api/use-auth-mutations";
import { toast } from "sonner";

export default function ImpersonateOrgPage() {
  const { mutateAsync: switchRoleAsync } = useSwitchRoleMutation();
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      try {
        await switchRoleAsync({ role: "organization" });
        toast.message("Viewing as Organization");
        router.replace("/dashboard");
      } catch {
        toast.error("Could not switch portal");
        router.replace("/dashboard");
      }
    })();
  }, [router, switchRoleAsync]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas text-mid">
      Switching portal…
    </div>
  );
}
