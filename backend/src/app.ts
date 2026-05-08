import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";

import authRoutes from "./routes/auth.routes";
import groupRouter from "./routes/group.routes";
import messageRouter from "./routes/message.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRouter);
app.use("/api/groups", groupRouter);

app.use((_, res) => {
  return res.status(404).json({ message: "Route not found" });
});

export default app;
