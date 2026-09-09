import { z } from "zod";

export const paymentStatusSchema = z.object({
  paymentStatus: z.enum(["NOT_REQUIRED", "PENDING", "PAID"]),
});

export type PaymentStatusInput = z.infer<typeof paymentStatusSchema>;
