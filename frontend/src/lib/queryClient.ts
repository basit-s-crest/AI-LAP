import { QueryClient } from "@tanstack/react-query";

// Singleton QueryClient for use outside of React (e.g. server actions, utilities)
// The QueryProvider creates its own instance per-session via createQueryClient()
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
