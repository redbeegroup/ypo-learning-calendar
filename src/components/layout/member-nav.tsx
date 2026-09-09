"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";

type Props = { links: { href: string; label: string }[]; userLabel: string };

export function MemberNav({ links, userLabel }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const linkClass = (href: string) =>
    `rounded-md px-2 py-1 hover:bg-blue-800 ${pathname === href || pathname.startsWith(href + "/") ? "bg-blue-800" : ""}`;

  return (
    <>
      <nav className="hidden items-center gap-2 text-sm sm:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass(l.href)}>
            {l.label}
          </Link>
        ))}
        <Link href="/profile" className="ml-2 text-blue-200 hover:text-white">
          {userLabel}
        </Link>
        <LogoutButton />
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
            <Link href="/profile" className="px-2 py-1 text-blue-200" onClick={() => setOpen(false)}>
              {userLabel}
            </Link>
            <div className="px-1">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
