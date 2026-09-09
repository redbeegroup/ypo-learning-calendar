import type { Prisma, User } from "@prisma/client";
import { sendEmail } from "@/server/email/sender";
import { promotedEmail, type EventSummary } from "@/server/email/templates";

type Tx = Prisma.TransactionClient;

/** Lock the event row so concurrent registrations and cancellations are serialised. */
export async function lockEvent(tx: Tx, eventId: string) {
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
}

/**
 * Promote waitlisted members (oldest first) while seats are free.
 * Must run inside a transaction that already holds the event lock.
 */
export async function promoteWaitlist(tx: Tx, event: { id: string; capacity: number | null }): Promise<User[]> {
  if (event.capacity === null) {
    // Unlimited capacity: everyone waitlisted gets a seat.
    const waiting = await tx.registration.findMany({
      where: { eventId: event.id, status: "WAITLISTED" },
      orderBy: { registeredAt: "asc" },
      include: { user: true },
    });
    if (waiting.length === 0) return [];
    await tx.registration.updateMany({ where: { id: { in: waiting.map((w) => w.id) } }, data: { status: "REGISTERED" } });
    return waiting.map((w) => w.user);
  }
  const registered = await tx.registration.count({ where: { eventId: event.id, status: "REGISTERED" } });
  const free = event.capacity - registered;
  if (free <= 0) return [];
  const waiting = await tx.registration.findMany({
    where: { eventId: event.id, status: "WAITLISTED" },
    orderBy: { registeredAt: "asc" },
    take: free,
    include: { user: true },
  });
  if (waiting.length === 0) return [];
  await tx.registration.updateMany({ where: { id: { in: waiting.map((w) => w.id) } }, data: { status: "REGISTERED" } });
  return waiting.map((w) => w.user);
}

export async function sendPromotionEmails(event: EventSummary, users: User[]) {
  for (const u of users) {
    await sendEmail(promotedEmail(u.email, u.name, event));
  }
}
