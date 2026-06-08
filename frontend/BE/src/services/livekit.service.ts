import { AccessToken } from "livekit-server-sdk";

export class LiveKitService {
  private static getCredentials() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const serverUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL || "";

    if (!apiKey || !apiSecret) {
      throw new Error("LiveKit credentials (LIVEKIT_API_KEY, LIVEKIT_API_SECRET) are not configured");
    }

    return { apiKey, apiSecret, serverUrl };
  }

  /**
   * Generates a LiveKit JWT token for a specific room and participant.
   * TTL is calculated as session duration + 15 minutes grace period.
   */
  public static async generateToken(
    roomName: string,
    identity: string,
    participantName: string,
    durationMinutes: number
  ): Promise<{ token: string; serverUrl: string }> {
    const { apiKey, apiSecret, serverUrl } = this.getCredentials();

    // Limit TTL: session duration in minutes + 15 min grace, converted to seconds
    const ttlSeconds = (durationMinutes + 15) * 60;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
      ttl: ttlSeconds,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return { token, serverUrl };
  }
}
