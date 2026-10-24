import { z } from "zod";
import { zCurrency, zEmail, zName, zPassword, zTimezone } from "@/lib/validation";

export const registerSchema = z
  .object({
    name: zName,
    email: zEmail,
    password: zPassword,
    confirmPassword: z.string(),
    baseCurrency: zCurrency,
    timezone: zTimezone,
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  })
  .refine((v) => v.password.toLowerCase() !== v.email, {
    path: ["password"],
    message: "Choose a password that isn't your email address.",
  });

export const loginSchema = z.object({
  email: zEmail,
  password: z.string().min(1, "Enter your password.").max(128),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email: zEmail });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: zPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
