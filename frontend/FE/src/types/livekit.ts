export interface LiveKitTokenResponse {
  sessionId: string;
  coachId: string;
  memberId: string;
  roomName: string;
  serverUrl: string;
  token: string;
  identity: string;
  role: string;
  participantName: string;
  scheduledAt: string;
  livekitStartedAt: string;
  expiresAt: string;
}

export interface LiveKitStatusResponse {
  sessionId: string;
  coachId: string;
  memberId: string;
  roomName: string | null;
  livekitStartedAt: string | null;
  livekitEndedAt: string | null;
  status: string;
}
