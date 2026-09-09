import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listChapters, listEventTypes } from "@/server/services/events";
import { EventFilters } from "@/components/events/event-filters";
import { EventCalendar } from "@/components/events/event-calendar";
import { Button } from "@/components/ui/button";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [chapters, types] = await Promise.all([listChapters(), listEventTypes()]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/events">List view</Link>
        </Button>
      </div>
      <EventFilters chapters={chapters} types={types} hideRange />
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
