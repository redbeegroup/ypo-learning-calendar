"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { id: string; name: string };

export function MembersFilters({ chapters, showChapter }: { chapters: Option[]; showChapter: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[240px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-9"
          aria-label="Search members"
        />
      </div>
      {showChapter && (
        <Select value={params.get("chapterId") ?? "ALL"} onValueChange={(v) => update({ chapterId: v === "ALL" ? undefined : v })}>
          <SelectTrigger className="w-[180px]" aria-label="Chapter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All chapters</SelectItem>
            {chapters.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={params.get("status") ?? "ALL"} onValueChange={(v) => update({ status: v === "ALL" ? undefined : v })}>
        <SelectTrigger className="w-[150px]" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="INVITED">Invited</SelectItem>
          <SelectItem value="DISABLED">Disabled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={params.get("role") ?? "ALL"} onValueChange={(v) => update({ role: v === "ALL" ? undefined : v })}>
        <SelectTrigger className="w-[160px]" aria-label="Role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All roles</SelectItem>
          <SelectItem value="MEMBER">Members</SelectItem>
          <SelectItem value="CHAPTER_ADMIN">Chapter managers</SelectItem>
          <SelectItem value="SUPER_ADMIN">Super admins</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
