import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const chapters = [
  { code: "SG", name: "Singapore", country: "Singapore" },
  { code: "SGG", name: "Singapore Gold", country: "Singapore" },
  { code: "MY", name: "Malaysia", country: "Malaysia" },
  { code: "MYG", name: "Malaysia Gold", country: "Malaysia" },
  { code: "TH", name: "Thailand", country: "Thailand" },
  { code: "ID", name: "Indonesia", country: "Indonesia" },
  { code: "PH", name: "Philippines", country: "Philippines" },
  { code: "PHG", name: "Philippines Gold", country: "Philippines" },
  { code: "VN", name: "Vietnam", country: "Vietnam" },
  { code: "MM", name: "Myanmar", country: "Myanmar" },
  { code: "KH", name: "Cambodia", country: "Cambodia" },
];

const eventTypes = [
  { name: "Business", color: "#2563eb" },
  { name: "Leadership", color: "#7c3aed" },
  { name: "Family", color: "#db2777" },
  { name: "Health & Wellness", color: "#16a34a" },
  { name: "Personal Growth", color: "#ea580c" },
  { name: "Networking", color: "#0891b2" },
  { name: "Social Impact", color: "#ca8a04" },
  { name: "Forum", color: "#475569" },
];

async function main() {
  for (const c of chapters) {
    await prisma.chapter.upsert({
      where: { code: c.code },
      update: { name: c.name, country: c.country },
      create: c,
    });
  }
  for (const [i, t] of eventTypes.entries()) {
    await prisma.eventType.upsert({
      where: { name: t.name },
      update: { color: t.color, sortOrder: i },
      create: { ...t, sortOrder: i },
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? "Super Admin";
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required");

  const sg = await prisma.chapter.findUniqueOrThrow({ where: { code: "SG" } });
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      chapterId: sg.id,
    },
  });
  console.log(`Seeded ${chapters.length} chapters, ${eventTypes.length} event types, super admin ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
