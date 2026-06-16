"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load env vars FIRST — before any other imports that might need them - reloaded
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dns_1 = __importDefault(require("dns"));
dns_1.default.setDefaultResultOrder("ipv4first");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const socketAuth_middleware_1 = require("./middleware/socketAuth.middleware");
const coachChat_1 = require("./sockets/coachChat");
const realtime_1 = require("./lib/realtime");
const orgNotification_scheduler_1 = require("./services/orgNotification.scheduler");
const sessionAutoCompleter_1 = require("./services/sessionAutoCompleter");
const PORT = Number(process.env.PORT) || 4000;
// Warn if sentiment env vars are absent
if (!process.env.PYTHON_BACKEND_URL) {
    console.warn("⚠️  PYTHON_BACKEND_URL is not set — sentiment forwarding will fail");
}
if (!process.env.PYTHON_ORG_ID) {
    console.warn("⚠️  PYTHON_ORG_ID is not set — sentiment forwarding will use default org");
}
const httpServer = (0, http_1.createServer)(app_1.default);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
    },
});
(0, realtime_1.initRealtime)(io);
// Register /coach-chat namespace
const coachChat = io.of("/coach-chat");
coachChat.use(socketAuth_middleware_1.socketAuthMiddleware);
coachChat.on("connection", (socket) => {
    (0, coachChat_1.registerCoachChatHandlers)(io, socket);
});
httpServer.listen(PORT, () => {
    (0, orgNotification_scheduler_1.startOrgNotificationScheduler)();
    (0, sessionAutoCompleter_1.startSessionAutoCompleter)();
    console.log(`✅ VASL Server running on http://localhost:${PORT}`);
    console.log(`   DATABASE_URL set:       ${!!process.env.DATABASE_URL}`);
    console.log(`   JWT_SECRET set:         ${!!process.env.JWT_SECRET}`);
    console.log(`   GMAIL_USER set:         ${!!process.env.GMAIL_USER}`);
    console.log(`   GMAIL_PASS set:         ${!!process.env.GMAIL_PASS}`);
    console.log(`   PYTHON_BACKEND_URL set: ${!!process.env.PYTHON_BACKEND_URL}`);
    console.log(`   PYTHON_ORG_ID set:      ${!!process.env.PYTHON_ORG_ID}`);
});
