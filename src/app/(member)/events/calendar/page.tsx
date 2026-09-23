import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listChapters, listEventFacets, listEventTypes } from "@/server/services/events";
import { buildEventQuery, type SearchParams } from "@/lib/event-query";
import { EventFilters } from "@/components/events/event-filters";
import { EventCalendar } from "@/components/events/event-calendar";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Counts cover the whole learning year shown in the calendar, not just the current month.
  const query = buildEventQuery(await searchParams, { includePast: "true" });
  const [chapters, types, facets] = await Promise.all([listChapters(), listEventTypes(), listEventFacets(user, query)]);
  const chapterOptions = chapters.map((c) => ({ ...c, count: facets.chapters[c.id] ?? 0 }));
  const typeOptions = types.map((t) => ({ ...t, count: facets.types[t.id] ?? 0 }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
      </div>
      <EventFilters chapters={chapterOptions} types={typeOptions} hideRange />
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {types.map((t) => (
          <span key={t.id} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: t.color }} /> {t.name}
          </span>
        ))}
      </div>
      <EventCalendar />
    </div>
  );
}
