"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import type { CoachMessageDTO } from "../types/coachMessage"
import { AUTH_TOKEN_KEY } from "@/constants/storage"

interface UseCoachSocketOptions {
  onNewMessage?: (msg: CoachMessageDTO) => void
  onReadReceipt?: (data: { partnerId: string; readAt: string }) => void
  onError?: (data: { code: string; message: string }) => void
}

interface UseCoachSocketReturn {
  sendMessage: (partnerId: string, content: string) => void
  sendTranscription: (partnerId: string, content: string, senderRole: "member" | "coach") => void
  isConnected: boolean
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

/** Read a cookie value by name, handling encodeURIComponent-encoded names/values. */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const encoded = encodeURIComponent(name) + "="
  const match = document.cookie.split("; ").find((row) => row.startsWith(encoded))
  return match ? decodeURIComponent(match.slice(encoded.length)) : null
}

export function useCoachSocket(
  options: UseCoachSocketOptions = {}
): UseCoachSocketReturn {
  const { onNewMessage, onReadReceipt, onError } = options
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Keep callbacks in refs so event listeners don't go stale
  const onNewMessageRef = useRef(onNewMessage)
  const onReadReceiptRef = useRef(onReadReceipt)
  const onErrorRef = useRef(onError)
  useEffect(() => { onNewMessageRef.current = onNewMessage }, [onNewMessage])
  useEffect(() => { onReadReceiptRef.current = onReadReceipt }, [onReadReceipt])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  useEffect(() => {
    // Read JWT from the safecircle_token cookie — this is where authSlice stores it.
    // Never read from localStorage; the app only uses cookies for auth.
    const token = readCookie(AUTH_TOKEN_KEY)

    const socket = io(`${BACKEND_URL}/coach-chat`, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = socket

    socket.on("connect", () => setIsConnected(true))
    socket.on("disconnect", () => setIsConnected(false))

    // Do NOT redirect to /login on connect_error.
    // The Next.js middleware already handles page-level auth — if the user
    // isn't logged in they won't reach this page at all.
    // A socket auth failure here means the backend is down or the token
    // expired mid-session; show "Connecting..." and let the user act.
    socket.on("connect_error", (err: Error) => {
      console.warn("[useCoachSocket] connect_error:", err.message)
      setIsConnected(false)
    })

    // message_saved = server ack for the sender's own message
    socket.on("message_saved", (msg: CoachMessageDTO) => {
      onNewMessageRef.current?.(msg)
    })

    // new_message = message delivered from the partner
    socket.on("new_message", (msg: CoachMessageDTO) => {
      onNewMessageRef.current?.(msg)
    })

    socket.on(
      "read_receipt",
      (data: { partnerId: string; readAt: string }) => {
        onReadReceiptRef.current?.(data)
      }
    )

    socket.on(
      "error",
      (data: { code: string; message: string }) => {
        onErrorRef.current?.(data)
      }
    )

    return () => {
      socket.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount/unmount only — callbacks handled via refs

  const sendMessage = useCallback(
    (partnerId: string, content: string) => {
      socketRef.current?.emit("send_message", { partnerId, content })
    },
    []
  )

  const sendTranscription = useCallback(
    (partnerId: string, content: string, senderRole: "member" | "coach") => {
      socketRef.current?.emit("send_transcription", { partnerId, content, senderRole })
    },
    []
  )

  return { sendMessage, sendTranscription, isConnected }
}
