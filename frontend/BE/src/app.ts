import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";

import authRoutes from "./routes/auth.routes";
import adminRouter from "./routes/admin.routes";
import coachRouter from "./routes/coach.routes";
import coachMessageRouter from "./routes/coachMessage.routes";
import groupRouter from "./routes/group.routes";
import messageRouter from "./routes/message.routes";
import moodRouter from "./routes/mood.routes";
import orgRouter from "./routes/org.routes";
import sessionRouter from "./routes/session.routes";
import sessionNoteRouter from "./routes/sessionNote.routes";
import onboardingRouter from "./routes/onboarding.routes";
import aiSessionNoteRouter from "./routes/aiSessionNote.routes";
import changeInsightRouter from "./routes/changeInsight.routes";

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev")); // logs: POST /api/auth/register 201 45ms
app.use("/uploads", express.static(path.resolve(process.cwd(), "public", "uploads")));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/coach", coachRouter);
app.use("/api/messages", messageRouter);
app.use("/api/groups", groupRouter);
app.use("/api/coach-messages", coachMessageRouter);
app.use("/api/admin", adminRouter);
app.use("/api/mood", moodRouter);
app.use("/api/org", orgRouter);
app.use("/api/sessions", sessionRouter);
app.use("/api/session-notes", sessionNoteRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/ai-session-notes", aiSessionNoteRouter);
app.use("/api/change-insights", changeInsightRouter);


// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_, res) => {
  return res.status(404).json({ message: "Route not found" });
});

export default app;
