import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Users, Building2, Tags, ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { canManageChapters, isAdmin } from "@/server/permissions";
import { LogoutButton } from "@/components/layout/logout-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/events");

  const nav = [
    { href: "/admin/events", label: "Events", icon: CalendarDays },
    { href: "/admin/members", label: "Members", icon: Users },
    ...(canManageChapters(user)
      ? [
          { href: "/admin/chapters", label: "Chapters", icon: Building2 },
          { href: "/admin/event-types", label: "Event types", icon: Tags },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-4">
          <div className="font-semibold">YPO SEA Learning</div>
          <div className="text-xs text-blue-200">
            Admin · {user.role === "SUPER_ADMIN" ? "All chapters" : user.chapterName}
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-2">
          <Link href="/events" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
            <ArrowLeft className="h-4 w-4" /> Member view
          </Link>
          <div className="px-1">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-3 md:hidden">
          <span className="font-semibold text-primary">Admin</span>
          <nav className="flex flex-wrap gap-3 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-primary">
                {n.label}
              </Link>
            ))}
            <Link href="/events">Member view</Link>
          </nav>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
