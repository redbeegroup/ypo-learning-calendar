import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listChapters, listEventTypes, listEvents } from "@/server/services/events";
import { buildEventQuery, flattenSearchParams, type SearchParams } from "@/lib/event-query";
import { EventCard } from "@/components/events/event-card";
import { EventFilters } from "@/components/events/event-filters";
import { Button } from "@/components/ui/button";

export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const query = buildEventQuery(sp);
  const [result, chapters, types] = await Promise.all([listEvents(user, query), listChapters(), listEventTypes()]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const pageLink = (page: number) => {
    const next = new URLSearchParams(flattenSearchParams(sp));
    next.set("page", String(page));
    return `/events?${next.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/events/calendar">Calendar view</Link>
        </Button>
      </div>
      <EventFilters chapters={chapters} types={types} />
      <p className="text-sm text-muted-foreground">
        {result.total} event{result.total === 1 ? "" : "s"}
      </p>
      {result.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No events match these filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {result.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageLink(result.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          <span className="text-sm">
            Page {result.page} of {pages}
          </span>
          {result.page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageLink(result.page + 1)}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
