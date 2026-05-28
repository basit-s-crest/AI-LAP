"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch } from "@/hooks/redux";
import { clearAllReadNotifications } from "@/lib/notificationReadStore";
import { setActiveCoachMessagesPartner } from "@/lib/activeView";
import { logout } from "@/store/slices/authSlice";
import { clearNotifications } from "@/store/slices/notificationSlice";
import { setLoggingOut } from "@/lib/api";

export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    setLoggingOut(true);
    queryClient.clear();
    dispatch(clearNotifications());
    dispatch(logout());
    clearAllReadNotifications();
    setActiveCoachMessagesPartner(null);
    router.replace("/login");
  };
}
