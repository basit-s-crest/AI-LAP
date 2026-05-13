import { QueryClient } from "@tanstack/react-query";

const defaultStaleTime = 60 * 1000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: defaultStaleTime,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof Error && /4\d\d/.test(error.message)) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
