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
  const params: Record<string, string> = { limit: "10" }
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
  const enabled = Boolean(partnerId)

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
    enabled,
  })

  const messages = useMemo(() => {
    if (!data?.pages) return []

    // Backend returns messages in DESC order (newest first) per page.
    // pages[0] = first fetch = most recent 10 messages
    // pages[1] = second fetch (scroll up) = older 10 messages
    // pages[2] = even older, etc.
    //
    // To display like WhatsApp (oldest at TOP, newest at BOTTOM):
    // 1. Reverse pages array so oldest page comes first
    // 2. Reverse each page's messages so oldest message in that page comes first
    //
    // Example with 2 pages of 3:
    // pages[0].messages = [msg10, msg9, msg8]  ← newest page
    // pages[1].messages = [msg7, msg6, msg5]   ← older page (loaded on scroll up)
    //
    // After fix:
    // reversed pages = [[msg7,msg6,msg5], [msg10,msg9,msg8]]
    // each page reversed = [[msg5,msg6,msg7], [msg8,msg9,msg10]]
    // flat = [msg5, msg6, msg7, msg8, msg9, msg10] ✅ oldest at top

    const allMessages = [...data.pages]
      .reverse()
      .flatMap((page) => [...page.messages].reverse())

    // Final safety sort by createdAt ascending to guarantee order
    // regardless of any backend inconsistency
    return allMessages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }, [data])

  const markRead = useCallback(() => {
    if (!partnerId) return
    markThreadRead(partnerId).catch(() => {})
  }, [partnerId])

  useEffect(() => {
    if (!enabled) return
    markRead()
    const handleFocus = () => markRead()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [enabled, markRead])

  const prependMessage = useCallback(
    (msg: CoachMessageDTO) => {
      queryClient.setQueryData<InfiniteData<ThreadPage>>(
        QUERY_KEY(partnerId),
        (old) => {
          if (!old) {
            return {
              pages: [{ messages: [msg], nextCursor: null }],
              pageParams: [undefined],
            }
          }
          // New socket message goes to page[0] (most recent page)
          // prepended so it becomes newest — after sort it appears at bottom
          const pages = [...old.pages]
          pages[0] = {
            ...pages[0],
            messages: [msg, ...pages[0].messages],
          }
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