import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const loginSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const inviteUserSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  name: z.string().min(1).max(120),
  chapterId: z.string().min(1),
  role: z.enum(["SUPER_ADMIN", "CHAPTER_ADMIN", "MEMBER"]).default("MEMBER"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
