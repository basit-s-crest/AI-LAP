import { z } from "zod";

export const bookSessionSchema = z.object({
  coachId: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      if (typeof val === "number") return val;
      const n = Number(val);
      return Number.isFinite(n) ? n : val;
    },
    z.number({ required_error: "Required", invalid_type_error: "Required" }),
  ),
  slot: z.string().min(1, "Select a time"),
});

export const sessionNoteSchema = z.object({
  clientId: z.string().min(1),
  sessionType: z.string().min(1),
  notes: z.string().min(1, "Add session notes"),
  nextGoal: z.string().optional(),
});
