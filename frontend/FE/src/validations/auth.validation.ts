import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email({ message: "Enter a valid email" }),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "At least 6 characters"),
});

export const registerSchema = z.object({
  role: z.enum(["user", "coach", "organization", "superadmin"]).optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z
    .string()
    .min(1, "Email is required")
    .email({ message: "Enter a valid email" }),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Use at least 8 characters"),
});

export const memberRegisterSchema = registerSchema.extend({
  role: z.literal("user"),
});

export const organizationRegisterSchema = registerSchema.extend({
  role: z.literal("organization"),
  organizationName: z.string().min(2, "Organization name is required"),
  organizationType: z.string().min(1, "Organization type is required"),
});

export const coachRegisterSchema = registerSchema.extend({
  role: z.literal("coach"),
  licenseNumber: z.string().min(3, "License number is required"),
  specialties: z.string().min(2, "Add at least one specialty"),
});

export const superadminRegisterSchema = registerSchema.extend({
  role: z.literal("superadmin"),
  adminCode: z.string().min(6, "Enter a valid admin invite code"),
});

export const verifySchema = z.object({
  code: z
    .string()
    .min(1, "Verification code is required")
    .length(6, "Enter the 6-digit code"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email({ message: "Enter a valid email" }),
});
