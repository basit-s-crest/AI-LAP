"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveKitService = void 0;
const livekit_server_sdk_1 = require("livekit-server-sdk");
class LiveKitService {
    static getCredentials() {
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
    static async generateToken(roomName, identity, participantName, durationMinutes) {
        const { apiKey, apiSecret, serverUrl } = this.getCredentials();
        // Limit TTL: session duration in minutes + 15 min grace, converted to seconds
        const ttlSeconds = (durationMinutes + 15) * 60;
        const at = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
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
exports.LiveKitService = LiveKitService;
