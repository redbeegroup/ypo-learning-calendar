import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, Video, Users, ExternalLink, UserRound } from "lucide-react";
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
        {event.chairs.length > 0 && (
          <div className="flex items-start gap-2 sm:col-span-2">
            <UserRound className="mt-0.5 h-4 w-4 text-primary" />
            <span>
              <span className="font-medium">Event Chair:</span>{" "}
              {event.chairs.join(", ")}
            </span>
          </div>
        )}
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

      {event.agenda.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Agenda</h2>
          <ol className="space-y-4 border-l-2 border-primary/30 pl-4">
            {event.agenda.map((item, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                {item.time && <div className="text-xs font-semibold uppercase tracking-wide text-primary">{item.time}</div>}
                <div className="font-medium">{item.title}</div>
                {item.description && (
                  <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{item.description}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {event.resources.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Event resources</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {event.resources.map((r, i) => (
              <div key={i} className="flex gap-3 rounded-lg border bg-card p-4">
                {r.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                    {r.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join("")}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold">{r.name}</div>
                  {r.bio && (
                    <div className="prose prose-sm prose-slate mt-1 max-w-none text-muted-foreground">
                      <Markdown>{r.bio}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
