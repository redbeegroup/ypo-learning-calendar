import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { isAdmin } from "@/server/permissions";
import { LogoutButton } from "@/components/layout/logout-button";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="bg-blue-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/events" className="font-semibold">
            YPO SEA Learning Calendar
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/events" className="hover:underline">
              Events
            </Link>
            <Link href="/events/calendar" className="hover:underline">
              Calendar
            </Link>
            <Link href="/my-registrations" className="hover:underline">
              My registrations
            </Link>
            {isAdmin(user) && (
              <Link href="/admin/events" className="hover:underline">
                Admin
              </Link>
            )}
            <span className="hidden text-blue-200 sm:inline">
              {user.name} · {user.chapterName}
            </span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
