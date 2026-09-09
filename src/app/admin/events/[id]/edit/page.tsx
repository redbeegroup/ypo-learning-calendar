import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getEvent, listChapters, listEventTypes } from "@/server/services/events";
import { ApiError } from "@/server/api";
import { EventForm } from "@/components/admin/event-form";
import { EventActions } from "@/components/admin/event-actions";
import { StatusBadge } from "@/components/events/event-badges";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
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
  const [chapters, types] = await Promise.all([listChapters(), listEventTypes()]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          Edit event <StatusBadge status={event.status} />
        </h1>
        <EventActions event={event} />
      </div>
      <EventForm
        chapters={chapters}
        types={types}
        lockedChapterId={user.role === "SUPER_ADMIN" ? undefined : user.chapterId}
        event={event}
      />
    </div>
  );
}
