import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError, forbidden } from "@/server/api";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { randomToken, hoursFromNow } from "@/server/auth/tokens";
import { sendEmail } from "@/server/email/sender";
import { inviteEmail, resetPasswordEmail } from "@/server/email/templates";
import { canManageUser, type Actor } from "@/server/permissions";
import type { InviteUserInput } from "@/lib/validation/auth";

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE" || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  }
  return user;
}

export async function inviteUser(actor: Actor, input: InviteUserInput) {
  if (!canManageUser(actor, { chapterId: input.chapterId, role: input.role as Role })) forbidden();
  const chapter = await prisma.chapter.findUnique({ where: { id: input.chapterId } });
  if (!chapter) throw new ApiError(400, "VALIDATION", "Unknown chapter", { chapterId: ["Unknown chapter"] });
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ApiError(409, "EMAIL_TAKEN", "A user with this email already exists");

  const token = randomToken();
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      chapterId: input.chapterId,
      role: input.role,
      status: "INVITED",
      inviteToken: token,
      inviteExpiresAt: hoursFromNow(24 * 7),
    },
  });
  await sendEmail(inviteEmail(user.email, user.name, token, chapter.name));
  return user;
}

export async function resendInvite(actor: Actor, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { chapter: true } });
  if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
  if (!canManageUser(actor, user)) forbidden();
  if (user.status !== "INVITED") throw new ApiError(400, "NOT_INVITED", "User has already accepted the invite");
  const token = randomToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { inviteToken: token, inviteExpiresAt: hoursFromNow(24 * 7) },
  });
  await sendEmail(inviteEmail(user.email, user.name, token, user.chapter.name));
}

export async function acceptInvite(token: string, password: string) {
  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date() || user.status !== "INVITED") {
    throw new ApiError(400, "INVALID_TOKEN", "This invite link is invalid or has expired");
  }
  return prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), status: "ACTIVE", inviteToken: null, inviteExpiresAt: null },
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") return; // do not reveal whether the account exists
  const token = randomToken();
  await prisma.user.update({ where: { id: user.id }, data: { resetToken: token, resetExpiresAt: hoursFromNow(1) } });
  await sendEmail(resetPasswordEmail(user.email, user.name, token));
}

export async function resetPassword(token: string, password: string) {
  const user = await prisma.user.findUnique({ where: { resetToken: token } });
  if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
    throw new ApiError(400, "INVALID_TOKEN", "This reset link is invalid or has expired");
  }
  return prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), resetToken: null, resetExpiresAt: null },
  });
}

export function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  chapterId: string;
  status?: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    chapterId: user.chapterId,
    status: user.status,
  };
}
