import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getEvent } from "@/server/services/events";
import { listEventRegistrations } from "@/server/services/registrations";
import { ApiError } from "@/server/api";
import { formatEventRange } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/events/event-badges";
import { RegistrationsTable } from "@/components/admin/registrations-table";

export default async function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
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
  if (!event.canManage) redirect("/admin/events");
  const groups = await listEventRegistrations(user, id);
  const paid = event.paymentType === "PAID";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/events" className="text-sm text-primary hover:underline">
            ← All events
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            {event.title} <StatusBadge status={event.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatEventRange(new Date(event.startAt), new Date(event.endAt), event.timezone)} ·{" "}
            {event.registeredCount} registered
            {event.capacity !== null && ` of ${event.capacity}`}
            {groups.waitlisted.length > 0 && ` · ${groups.waitlisted.length} waitlisted`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/events/${event.id}/edit`}>Edit event</Link>
          </Button>
          <Button asChild>
            <a href={`/api/v1/events/${event.id}/registrations/export`}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </a>
          </Button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Registered ({groups.registered.length})</h2>
        <RegistrationsTable rows={groups.registered} paid={paid} emptyText="Nobody has registered yet." />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Waitlist ({groups.waitlisted.length})</h2>
        <RegistrationsTable rows={groups.waitlisted} paid={paid} emptyText="The waitlist is empty." />
      </section>
      {groups.cancelled.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-muted-foreground">Cancelled ({groups.cancelled.length})</h2>
          <RegistrationsTable rows={groups.cancelled} paid={paid} emptyText="" />
        </section>
      )}
    </div>
  );
}
