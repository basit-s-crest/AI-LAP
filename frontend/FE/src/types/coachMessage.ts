export interface CoachMessageDTO {
  id: string
  userId: string
  coachId: string
  content: string
  senderRole: "member" | "coach"
  read: boolean
  createdAt: string // ISO 8601
}

export interface ConversationSummary {
  partnerId: string
  partnerName: string
  partnerAvatar: string | null
  lastMessage: string
  lastMessageAt: string // ISO 8601
  unreadCount: number
}

export interface ThreadPage {
  messages: CoachMessageDTO[]
  nextCursor: string | null
}
