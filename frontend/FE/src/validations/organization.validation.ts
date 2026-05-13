import { z } from "zod";

export const organizationSettingsSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  type: z.string().min(1),
  contactEmail: z.string().min(1).email(),
});
