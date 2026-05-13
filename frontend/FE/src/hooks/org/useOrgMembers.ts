"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
  avatar: string | null;
  role: string;
  status: "active" | "pending";
}

export function useOrgMembers() {
  return useQuery({
    queryKey: ["org", "members"],
    queryFn: async (): Promise<OrgMember[]> => {
      const { data } = await api.get("/api/org/members");
      return data;
    },
  });
}
