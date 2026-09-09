import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";

const isoDate = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));
const nullableIsoDate = isoDate
  .nullable()
  .optional()
  .transform((d) => d ?? null);
const nullableUrl = z
  .string()
  .url()
  .max(2000)
  .nullable()
  .optional()
  .transform((v) => v || null);
const nullableText = z
  .string()
  .max(5000)
  .nullable()
  .optional()
  .transform((v) => v || null);

export const VISIBILITIES = ["LOCAL", "REGIONAL", "CHAPTER_SPECIFIC"] as const;
export const PAYMENT_TYPES = ["FREE", "PAID"] as const;

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().max(20000).default(""),
    hostChapterId: z.string().min(1, "Host chapter is required"),
    eventTypeId: z.string().min(1, "Event type is required"),
    startAt: isoDate,
    endAt: isoDate,
    timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
    venue: z.string().trim().max(300).default(""),
    isOnline: z.boolean().default(false),
    onlineUrl: nullableUrl,
    coverImageUrl: nullableUrl,
    visibility: z.enum(VISIBILITIES),
    accessChapterIds: z.array(z.string().min(1)).default([]),
    capacity: z
      .number()
      .int()
      .positive()
      .max(100000)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    registrationOpensAt: nullableIsoDate,
    registrationClosesAt: nullableIsoDate,
    paymentType: z.enum(PAYMENT_TYPES),
    price: z
      .number()
      .nonnegative()
      .max(1_000_000)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    currency: z
      .string()
      .trim()
      .length(3)
      .toUpperCase()
      .nullable()
      .optional()
      .transform((v) => v || null),
    paymentInstructions: nullableText,
    paymentUrl: nullableUrl,
  })
  .superRefine((v, ctx) => {
    if (v.endAt <= v.startAt) ctx.addIssue({ code: "custom", path: ["endAt"], message: "End must be after start" });
    if (v.visibility === "CHAPTER_SPECIFIC" && v.accessChapterIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["accessChapterIds"], message: "Select at least one chapter" });
    }
    if (v.paymentType === "PAID") {
      if (v.price === null) {
        ctx.addIssue({ code: "custom", path: ["price"], message: "Price is required for paid events" });
      }
      if (!v.currency) {
        ctx.addIssue({ code: "custom", path: ["currency"], message: "Currency is required for paid events" });
      }
    }
    if (v.registrationOpensAt && v.registrationClosesAt && v.registrationClosesAt <= v.registrationOpensAt) {
      ctx.addIssue({
        code: "custom",
        path: ["registrationClosesAt"],
        message: "Registration must close after it opens",
      });
    }
  });

export type EventInput = z.infer<typeof eventInputSchema>;

const csv = z
  .string()
  .optional()
  .transform((s) =>
    s
      ? s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [],
  );
const bool = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .optional()
  .transform((v) => v === true || v === "true");

export const eventListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined),
  chapterIds: csv,
  typeIds: csv,
  from: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((s) => (s ? new Date(s) : undefined)),
  to: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((s) => (s ? new Date(s) : undefined)),
  payment: z.enum(PAYMENT_TYPES).optional(),
  registrableOnly: bool,
  includePast: bool,
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type EventListQuery = z.infer<typeof eventListQuerySchema>;
