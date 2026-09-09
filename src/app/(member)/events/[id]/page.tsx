import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, Video, Users, ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getEvent } from "@/server/services/events";
import { ApiError } from "@/server/api";
import { formatEventRange } from "@/lib/dates";
import { Markdown } from "@/components/events/markdown";
import {
  ChapterBadge,
  PaymentBadge,
  StatusBadge,
  TypeBadge,
  registrationHint,
  visibilityLabel,
} from "@/components/events/event-badges";
import { RegisterButton } from "@/components/events/register-button";
import { Button } from "@/components/ui/button";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  let event;
  try {
    event = await getEvent(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const paymentPending = event.paymentType === "PAID" && event.myRegistration?.paymentStatus === "PENDING";

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/events" className="text-sm text-primary hover:underline">
          ← All events
        </Link>
      </div>
      {event.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverImageUrl} alt="" className="h-56 w-full rounded-lg object-cover" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={event.eventType} />
        <ChapterBadge chapter={event.hostChapter} />
        <PaymentBadge event={event} />
        {event.status !== "PUBLISHED" && <StatusBadge status={event.status} />}
      </div>
      <h1 className="text-3xl font-semibold">{event.title}</h1>

      <div className="grid gap-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
          <span>{formatEventRange(new Date(event.startAt), new Date(event.endAt), event.timezone)}</span>
        </div>
        <div className="flex items-start gap-2">
          {event.isOnline ? (
            <Video className="mt-0.5 h-4 w-4 text-primary" />
          ) : (
            <MapPin className="mt-0.5 h-4 w-4 text-primary" />
          )}
          <span>
            {event.isOnline ? (
              event.onlineUrl ? (
                <a href={event.onlineUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Online event – join link <ExternalLink className="inline h-3 w-3" />
                </a>
              ) : (
                "Online event"
              )
            ) : (
              event.venue || "Venue to be announced"
            )}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Users className="mt-0.5 h-4 w-4 text-primary" />
          <span>
            {visibilityLabel(event)}
            {event.capacity !== null && ` · ${event.registeredCount}/${event.capacity} registered`}
            {event.waitlistedCount > 0 && ` · ${event.waitlistedCount} waitlisted`}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-medium">{registrationHint(event)}</span>
        </div>
      </div>

      {event.paymentType === "PAID" && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            paymentPending ? "border-amber-400 bg-amber-100" : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="font-semibold">
            {paymentPending ? "Payment pending: " : "Paid event: "}
            {event.currency} {event.price}
          </div>
          {event.paymentInstructions && <p className="mt-1 whitespace-pre-line">{event.paymentInstructions}</p>}
          {event.paymentUrl && (
            <a
              href={event.paymentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-primary hover:underline"
            >
              Payment link <ExternalLink className="inline h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-2">
        <RegisterButton event={event} />
        {event.canManage && (
          <>
            <Button asChild variant="outline">
              <Link href={`/admin/events/${event.id}/edit`}>Edit event</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/events/${event.id}/registrations`}>Registrations</Link>
            </Button>
          </>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">About this event</h2>
        <Markdown>{event.description}</Markdown>
      </section>
    </article>
  );
}
