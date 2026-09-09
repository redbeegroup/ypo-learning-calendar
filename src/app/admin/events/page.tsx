import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listChapters, listEventTypes, listEvents } from "@/server/services/events";
import { buildEventQuery, flattenSearchParams, type SearchParams } from "@/lib/event-query";
import { EventFilters } from "@/components/events/event-filters";
import { StatusBadge, PaymentBadge } from "@/components/events/event-badges";
import { formatEventRange } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EventActions } from "@/components/admin/event-actions";

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const raw = flattenSearchParams(sp);
  const query = buildEventQuery(sp, { status: raw.status ?? "PUBLISHED", pageSize: "50" });
  const scoped = { ...query, chapterIds: user.role === "SUPER_ADMIN" ? query.chapterIds : [user.chapterId] };
  const [result, chapters, types] = await Promise.all([listEvents(user, scoped), listChapters(), listEventTypes()]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Button asChild>
          <Link href="/admin/events/new">New event</Link>
        </Button>
      </div>
      <EventFilters chapters={chapters} types={types} showStatus />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Chapter</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No events.
                </TableCell>
              </TableRow>
            )}
            {result.items.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link href={`/admin/events/${e.id}/edit`} className="font-medium text-primary hover:underline">
                    {e.title}
                  </Link>
                  <div className="mt-1 flex gap-1">
                    <PaymentBadge event={e} />
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {formatEventRange(new Date(e.startAt), new Date(e.endAt), e.timezone)}
                </TableCell>
                <TableCell>{e.hostChapter.name}</TableCell>
                <TableCell>
                  {e.registeredCount}
                  {e.capacity !== null && ` / ${e.capacity}`}
                </TableCell>
                <TableCell>
                  <StatusBadge status={e.status} />
                </TableCell>
                <TableCell className="text-right">
                  <EventActions event={e} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
