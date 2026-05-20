"use client";

import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/hooks/redux";
import { clearAllReadNotifications } from "@/lib/notificationReadStore";
import { logout } from "@/store/slices/authSlice";

export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  return () => {
    // Clear vasl_ localStorage keys
    localStorage.removeItem("vasl_token");
    localStorage.removeItem("vasl_user");
    clearAllReadNotifications();

    // Dispatch Redux logout (also clears azadi_ cookies via authSlice)
    dispatch(logout());

    // Redirect to login
    router.push("/login");
  };
}
