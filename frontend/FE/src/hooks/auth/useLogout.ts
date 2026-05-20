"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch } from "@/hooks/redux";
import { clearAllReadNotifications } from "@/lib/notificationReadStore";
import { setActiveCoachMessagesPartner } from "@/lib/activeView";
import { logout } from "@/store/slices/authSlice";
import { clearNotifications } from "@/store/slices/notificationSlice";

export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    localStorage.removeItem("vasl_token");
    localStorage.removeItem("vasl_user");
    clearAllReadNotifications();
    setActiveCoachMessagesPartner(null);

    dispatch(clearNotifications());
    dispatch(logout());
    queryClient.clear();

    router.replace("/login");
  };
}
