import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, MapPin, Video } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { listMyRegistrations } from "@/server/services/registrations";
import { formatEventRange } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { ChapterBadge, PaymentBadge, TypeBadge } from "@/components/events/event-badges";

type Item = Awaited<ReturnType<typeof listMyRegistrations>>["upcoming"][number];

function RegistrationRow({ item }: { item: Item }) {
  const e = item.event;
  return (
    <Link
      href={`/events/${e.id}`}
      className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition hover:border-primary sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={e.eventType} />
          <ChapterBadge chapter={e.hostChapter} />
          <PaymentBadge event={e} />
        </div>
        <div className="font-semibold">{e.title}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            {formatEventRange(new Date(e.startAt), new Date(e.endAt), e.timezone)}
          </span>
          <span className="flex items-center gap-1">
            {e.isOnline ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
            {e.isOnline ? "Online" : e.venue || "Venue TBA"}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.status === "WAITLISTED" ? (
          <Badge className="bg-amber-500 hover:bg-amber-500">Waitlisted</Badge>
        ) : (
          <Badge className="bg-green-600 hover:bg-green-600">Registered</Badge>
        )}
        {item.paymentStatus === "PENDING" && <Badge variant="outline">Payment pending</Badge>}
        {item.paymentStatus === "PAID" && <Badge variant="outline">Paid</Badge>}
      </div>
    </Link>
  );
}

export default async function MyRegistrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { upcoming, past } = await listMyRegistrations(user);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">My registrations</h1>
        <h2 className="text-lg font-medium">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            You have no upcoming registrations.{" "}
            <Link href="/events" className="text-primary hover:underline">
              Browse events
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((item) => (
              <RegistrationRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Past</h2>
          <div className="space-y-3 opacity-80">
            {past.map((item) => (
              <RegistrationRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
