import Link from "next/link";
import { MapPin, Video, CalendarDays } from "lucide-react";
import type { EventDto } from "@/server/services/events";
import { formatEventRange } from "@/lib/dates";
import { ChapterBadge, PaymentBadge, TypeBadge, registrationHint } from "@/components/events/event-badges";

export function EventCard({ event }: { event: EventDto }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow"
    >
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={event.eventType} />
        <ChapterBadge chapter={event.hostChapter} />
        <PaymentBadge event={event} />
      </div>
      <h3 className="mt-2 text-lg font-semibold leading-snug">{event.title}</h3>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span>{formatEventRange(new Date(event.startAt), new Date(event.endAt), event.timezone)}</span>
        </div>
        <div className="flex items-center gap-2">
          {event.isOnline ? <Video className="h-4 w-4 shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
          <span>{event.isOnline ? "Online" : event.venue || "Venue to be announced"}</span>
        </div>
      </div>
      <p className={`mt-3 text-xs font-medium ${event.registration.ok ? "text-primary" : "text-muted-foreground"}`}>
        {registrationHint(event)}
      </p>
    </Link>
  );
}
