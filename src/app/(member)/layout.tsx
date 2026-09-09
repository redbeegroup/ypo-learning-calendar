import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { isAdmin } from "@/server/permissions";
import { MemberNav } from "@/components/layout/member-nav";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const links = [
    { href: "/events", label: "Events" },
    { href: "/events/calendar", label: "Calendar" },
    { href: "/my-registrations", label: "My registrations" },
    ...(isAdmin(user) ? [{ href: "/admin/events", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="relative bg-blue-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/events" className="font-semibold">
            YPO SEA Learning Calendar
          </Link>
          <MemberNav links={links} userLabel={`${user.name} · ${user.chapterName}`} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
