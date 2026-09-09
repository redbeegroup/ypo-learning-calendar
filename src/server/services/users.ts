import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError, forbidden } from "@/server/api";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { randomToken, hoursFromNow } from "@/server/auth/tokens";
import { sendEmail } from "@/server/email/sender";
import { inviteEmail, resetPasswordEmail } from "@/server/email/templates";
import { canManageUser, type Actor } from "@/server/permissions";
import type { InviteUserInput } from "@/lib/validation/auth";
import type { UpdateUserInput, UserListQuery } from "@/lib/validation/users";

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

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  chapterId: true,
  createdAt: true,
  inviteExpiresAt: true,
  chapter: { select: { name: true } },
} satisfies Prisma.UserSelect;

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "INVITED" | "ACTIVE" | "DISABLED";
  chapterId: string;
  chapterName: string;
  createdAt: string;
  inviteExpired: boolean;
};

function toAdminUser(u: Prisma.UserGetPayload<{ select: typeof userSelect }>): AdminUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    chapterId: u.chapterId,
    chapterName: u.chapter.name,
    createdAt: u.createdAt.toISOString(),
    inviteExpired: u.status === "INVITED" && !!u.inviteExpiresAt && u.inviteExpiresAt < new Date(),
  };
}

export async function listUsers(actor: Actor, q: UserListQuery) {
  if (actor.role === "MEMBER") forbidden();
  const where: Prisma.UserWhereInput = {};
  if (actor.role === "CHAPTER_ADMIN") where.chapterId = actor.chapterId;
  else if (q.chapterId) where.chapterId = q.chapterId;
  if (q.role) where.role = q.role;
  if (q.status) where.status = q.status;
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { email: { contains: q.q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ name: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { items: rows.map(toAdminUser), total, page: q.page, pageSize: q.pageSize };
}

export async function updateUser(actor: Actor, userId: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
  if (!canManageUser(actor, user)) forbidden();
  const target = { chapterId: input.chapterId ?? user.chapterId, role: (input.role ?? user.role) as Role };
  if (!canManageUser(actor, target)) forbidden("You cannot assign that chapter or role");
  if (user.id === actor.id) {
    if (input.status === "DISABLED") throw new ApiError(400, "SELF_DISABLE", "You cannot disable your own account");
    if (input.role && input.role !== user.role) {
      throw new ApiError(400, "SELF_ROLE", "You cannot change your own role");
    }
  }
  if (input.chapterId && input.chapterId !== user.chapterId) {
    const chapter = await prisma.chapter.findUnique({ where: { id: input.chapterId } });
    if (!chapter) throw new ApiError(400, "VALIDATION", "Unknown chapter", { chapterId: ["Unknown chapter"] });
  }
  let status = user.status;
  if (input.status === "DISABLED") status = "DISABLED";
  else if (input.status === "ACTIVE") status = user.passwordHash ? "ACTIVE" : "INVITED";
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name: input.name, chapterId: input.chapterId, role: input.role, status },
    select: userSelect,
  });
  return toAdminUser(updated);
}

export async function changePassword(actor: Actor, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ApiError(400, "WRONG_PASSWORD", "Current password is incorrect", {
      currentPassword: ["Current password is incorrect"],
    });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
}
