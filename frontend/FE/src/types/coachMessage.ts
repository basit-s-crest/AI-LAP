export interface CoachMessageDTO {
  id: string
  userId: string
  coachId: string
  content: string
  senderRole: "member" | "coach"
  read: boolean
  createdAt: string // ISO 8601
  risk_tier?: "low" | "moderate" | "high" | "crisis" | null
  risk_score?: number | null
  risk_label?: "Analysed" | "Crisis" | "High Risk" | "Moderate" | "Low Risk" | null
  signal_codes?: string[] | null
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
