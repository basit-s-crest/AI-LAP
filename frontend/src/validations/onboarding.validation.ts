import { z } from "zod";

export const onboardingDemographicsSchema = z.object({
  age: z.string().optional(),
  identity: z.string().optional(),
  gender: z.string().optional(),
  orient: z.string().optional(),
});

export const likertAssessmentSchema = z.object({
  answer: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ required_error: "Required", invalid_type_error: "Required" }).min(0).max(3),
  ),
});
