"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { GroupPost } from "@/types/group";

export function useCreatePost(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string): Promise<GroupPost> => {
      const { data } = await api.post(`/api/groups/${groupId}/posts`, { body });
      return data;
    },
    onSuccess: (newPost) => {
      queryClient.setQueryData(["group", groupId], (old: any) => {
        if (!old) return old;
        return { ...old, posts: [newPost, ...(old.posts ?? [])] };
      });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}
