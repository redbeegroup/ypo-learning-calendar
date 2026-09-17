import { z } from "zod";

export const ROLES = ["SUPER_ADMIN", "CHAPTER_ADMIN", "MEMBER"] as const;
export const USER_STATUSES = ["INVITED", "ACTIVE", "DISABLED"] as const;

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    chapterId: z.string().min(1).optional(),
    /** undefined = unchanged, null = clear. */
    secondaryChapterId: z.string().min(1).nullable().optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" })
  .refine((v) => !v.chapterId || !v.secondaryChapterId || v.chapterId !== v.secondaryChapterId, {
    path: ["secondaryChapterId"],
    message: "Secondary chapter must differ from the primary chapter",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined),
  chapterId: z.string().optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
