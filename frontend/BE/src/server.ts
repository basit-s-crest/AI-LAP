// Load env vars FIRST — before any other imports that might need them - reloaded
import dotenv from "dotenv";
dotenv.config();

import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app";
import { socketAuthMiddleware } from "./middleware/socketAuth.middleware";
import { registerCoachChatHandlers } from "./sockets/coachChat";
import { initRealtime } from "./lib/realtime";
import { startOrgNotificationScheduler } from "./services/orgNotification.scheduler";
import { startSessionAutoCompleter } from "./services/sessionAutoCompleter";

const PORT = Number(process.env.PORT) || 4000;

// Warn if sentiment env vars are absent
if (!process.env.PYTHON_BACKEND_URL) {
  console.warn("⚠️  PYTHON_BACKEND_URL is not set — sentiment forwarding will fail");
}
if (!process.env.PYTHON_ORG_ID) {
  console.warn("⚠️  PYTHON_ORG_ID is not set — sentiment forwarding will use default org");
}

const httpServer = createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000"
].filter(Boolean) as string[];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

initRealtime(io);

// Register /coach-chat namespace
const coachChat = io.of("/coach-chat");
coachChat.use(socketAuthMiddleware);
coachChat.on("connection", (socket) => {
  registerCoachChatHandlers(io, socket);
});

httpServer.listen(PORT, "0.0.0.0", () => {
  startOrgNotificationScheduler();
  startSessionAutoCompleter();
  console.log(`✅ VASL Server running on http://localhost:${PORT}`);
  console.log(`   DATABASE_URL set:       ${!!process.env.DATABASE_URL}`);
  console.log(`   JWT_SECRET set:         ${!!process.env.JWT_SECRET}`);
  console.log(`   GMAIL_USER set:         ${!!process.env.GMAIL_USER}`);
  console.log(`   GMAIL_PASS set:         ${!!process.env.GMAIL_PASS}`);
  console.log(`   PYTHON_BACKEND_URL set: ${!!process.env.PYTHON_BACKEND_URL}`);
  console.log(`   PYTHON_ORG_ID set:      ${!!process.env.PYTHON_ORG_ID}`);
});
