"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const coach_routes_1 = __importDefault(require("./routes/coach.routes"));
const coachMessage_routes_1 = __importDefault(require("./routes/coachMessage.routes"));
const group_routes_1 = __importDefault(require("./routes/group.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const mood_routes_1 = __importDefault(require("./routes/mood.routes"));
const org_routes_1 = __importDefault(require("./routes/org.routes"));
const app = (0, express_1.default)();
// ─── Middleware ───────────────────────────────────────────────────────────────
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
app.use((0, morgan_1.default)("dev")); // logs: POST /api/auth/register 201 45ms
// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", auth_routes_1.default);
app.use("/api/coach", coach_routes_1.default);
app.use("/api/messages", message_routes_1.default);
app.use("/api/groups", group_routes_1.default);
app.use("/api/coach-messages", coachMessage_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
app.use("/api/mood", mood_routes_1.default);
app.use("/api/org", org_routes_1.default);
// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_, res) => {
    return res.status(404).json({ message: "Route not found" });
});
exports.default = app;
