import { z } from "zod";

export const chapterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only")
    .transform((s) => s.toUpperCase()),
  country: z.string().trim().min(1, "Country is required").max(120),
  isActive: z.boolean().default(true),
});

export const chapterUpdateSchema = chapterSchema.partial();

export const eventTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #2563eb").default("#2563eb"),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export const eventTypeUpdateSchema = eventTypeSchema.partial();

export type ChapterInput = z.infer<typeof chapterSchema>;
export type ChapterUpdateInput = z.infer<typeof chapterUpdateSchema>;
export type EventTypeInput = z.infer<typeof eventTypeSchema>;
export type EventTypeUpdateInput = z.infer<typeof eventTypeUpdateSchema>;
