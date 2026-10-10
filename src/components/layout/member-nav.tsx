"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Settings, UserRound, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";

type Props = {
  links: { href: string; label: string }[];
  user: { name: string; email: string; chapterName: string; isAdmin: boolean };
};

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function MemberNav({ links, user }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  // Only the most specific matching link is active, so /events/calendar highlights Calendar but not Events.
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const activeHref = links.filter((l) => matches(l.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const linkClass = (href: string) => `rounded-md px-2 py-1 hover:bg-blue-800 ${href === activeHref ? "bg-blue-800" : ""}`;

  async function signOut() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <nav className="hidden items-center gap-2 text-sm sm:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass(l.href)}>
            {l.label}
          </Link>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-700 text-sm font-semibold text-white ring-offset-blue-900 hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
              aria-label="Account menu"
            >
              {initials(user.name)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.chapterName}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <UserRound className="h-4 w-4" /> My profile
              </Link>
            </DropdownMenuItem>
            {user.isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin/events" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Admin
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <button
        type="button"
        className="rounded-md p-2 hover:bg-blue-800 sm:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 border-t border-blue-800 bg-blue-900 p-3 sm:hidden">
          <div className="flex flex-col gap-1 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <div className="my-1 border-t border-blue-800" />
            <div className="px-2 py-1 text-xs text-blue-200">
              {user.name} · {user.chapterName}
            </div>
            <Link href="/profile" className={linkClass("/profile")} onClick={() => setOpen(false)}>
              My profile
            </Link>
            {user.isAdmin && (
              <Link href="/admin/events" className={linkClass("/admin/events")} onClick={() => setOpen(false)}>
                Admin
              </Link>
            )}
            <button type="button" className="rounded-md px-2 py-1 text-left hover:bg-blue-800" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
