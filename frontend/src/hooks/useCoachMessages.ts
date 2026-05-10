"use client"

import { useEffect, useCallback, useMemo } from "react"
import {
  useInfiniteQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query"
import api from "../lib/api"
import type { CoachMessageDTO, ThreadPage } from "../types/coachMessage"

const QUERY_KEY = (partnerId: string) => ["coach-messages", partnerId] as const

async function fetchThread(
  partnerId: string,
  cursor?: string
): Promise<ThreadPage> {
  const params: Record<string, string> = { limit: "50" }
  if (cursor) params.cursor = cursor

  const { data } = await api.get<ThreadPage>(
    `/api/coach-messages/${partnerId}`,
    { params }
  )
  return data
}

async function markThreadRead(partnerId: string): Promise<void> {
  await api.post(`/api/coach-messages/${partnerId}/read`)
}

export interface UseCoachMessagesReturn {
  messages: CoachMessageDTO[]
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
  prependMessage: (msg: CoachMessageDTO) => void
}

export function useCoachMessages(partnerId: string): UseCoachMessagesReturn {
  const queryClient = useQueryClient()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<ThreadPage, Error, InfiniteData<ThreadPage>, readonly ["coach-messages", string], string | undefined>({
    queryKey: QUERY_KEY(partnerId),
    queryFn: ({ pageParam }) => fetchThread(partnerId, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  // Flatten all pages into a single messages array
  const messages = useMemo(
    () => data?.pages.flatMap((page) => page.messages) ?? [],
    [data]
  )

  // Mark as read on mount and on window focus
  const markRead = useCallback(() => {
    markThreadRead(partnerId).catch(() => {
      // Silently ignore read errors
    })
  }, [partnerId])

  useEffect(() => {
    markRead()

    const handleFocus = () => markRead()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [markRead])

  // Prepend a new socket message to the cache without triggering a refetch.
  // Despite the name "prependMessage" (per spec), new messages are appended to
  // the last page to maintain ascending chronological display order.
  const prependMessage = useCallback(
    (msg: CoachMessageDTO) => {
      queryClient.setQueryData<InfiniteData<ThreadPage>>(
        QUERY_KEY(partnerId),
        (old) => {
          if (!old) {
            // No cache yet — create initial structure
            return {
              pages: [{ messages: [msg], nextCursor: null }],
              pageParams: [undefined],
            }
          }

          // Append to the last page to maintain chronological order
          const pages = old.pages.map((page, index) => {
            if (index === old.pages.length - 1) {
              return {
                ...page,
                messages: [...page.messages, msg],
              }
            }
            return page
          })

          return { ...old, pages }
        }
      )
    },
    [partnerId, queryClient]
  )

  return {
    messages,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    isLoading,
    prependMessage,
  }
}
