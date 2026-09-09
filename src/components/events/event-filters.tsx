"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGE_OPTIONS } from "@/lib/event-query";

type Option = { id: string; name: string };
type Props = { chapters: Option[]; types: Option[]; showStatus?: boolean };

const FILTER_KEYS = ["q", "chapterIds", "typeIds", "payment", "registrableOnly", "range", "status"];

export function EventFilters({ chapters, types, showStatus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const selectedChapters = (params.get("chapterIds") ?? "").split(",").filter(Boolean);
  const selectedTypes = (params.get("typeIds") ?? "").split(",").filter(Boolean);

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
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

  function toggle(key: "chapterIds" | "typeIds", id: string, current: string[]) {
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    update({ [key]: next.join(",") });
  }

  const hasFilters = FILTER_KEYS.some((k) => params.get(k));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search events by title, description or venue…"
          className="h-11 pl-9 text-base"
          aria-label="Search events"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {selectedChapters.length
                ? `${selectedChapters.length} chapter${selectedChapters.length > 1 ? "s" : ""}`
                : "All chapters"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Chapters</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {chapters.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={selectedChapters.includes(c.id)}
                onCheckedChange={() => toggle("chapterIds", c.id, selectedChapters)}
                onSelect={(e) => e.preventDefault()}
              >
                {c.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {selectedTypes.length ? `${selectedTypes.length} theme${selectedTypes.length > 1 ? "s" : ""}` : "All themes"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Themes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {types.map((t) => (
              <DropdownMenuCheckboxItem
                key={t.id}
                checked={selectedTypes.includes(t.id)}
                onCheckedChange={() => toggle("typeIds", t.id, selectedTypes)}
                onSelect={(e) => e.preventDefault()}
              >
                {t.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select
          value={params.get("range") ?? "upcoming"}
          onValueChange={(v) => update({ range: v === "upcoming" ? undefined : v })}
        >
          <SelectTrigger className="h-8 w-[150px] text-sm" aria-label="Date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={params.get("payment") ?? "ALL"} onValueChange={(v) => update({ payment: v === "ALL" ? undefined : v })}>
          <SelectTrigger className="h-8 w-[130px] text-sm" aria-label="Payment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Free & paid</SelectItem>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>

        {showStatus ? (
          <Select
            value={params.get("status") ?? "PUBLISHED"}
            onValueChange={(v) => update({ status: v === "PUBLISHED" ? undefined : v })}
          >
            <SelectTrigger className="h-8 w-[130px] text-sm" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="DRAFT">Drafts</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-2">
            <Switch
              id="registrable"
              checked={params.get("registrableOnly") === "true"}
              onCheckedChange={(v) => update({ registrableOnly: v ? "true" : undefined })}
            />
            <Label htmlFor="registrable" className="text-sm">
              Only events I can register for
            </Label>
          </div>
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              startTransition(() => router.replace(pathname));
            }}
          >
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
        {pending && <span className="text-xs text-muted-foreground">Updating…</span>}
      </div>
    </div>
  );
}
