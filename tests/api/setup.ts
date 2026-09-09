import { beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/server/db";
import { setEmailSender, type Email } from "@/server/email/sender";

process.env.JWT_SECRET ??= "test-secret-that-is-long-enough-123456";
process.env.APP_URL ??= "http://localhost:3000";

export const sentEmails: Email[] = [];

const usesTestDb = Boolean(process.env.DATABASE_URL?.includes("ypo_test"));

beforeAll(() => {
  setEmailSender({
    async send(e) {
      sentEmails.push(e);
    },
  });
});

beforeEach(async () => {
  sentEmails.length = 0;
  if (!usesTestDb) return; // unit tests do not touch the DB
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Registration", "EventChapterAccess", "Event", "User", "EventType", "Chapter" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
