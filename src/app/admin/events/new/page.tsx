import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listChapters, listEventTypes } from "@/server/services/events";
import { EventForm } from "@/components/admin/event-form";

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [chapters, types] = await Promise.all([listChapters(), listEventTypes()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New event</h1>
      <EventForm
        chapters={chapters}
        types={types}
        lockedChapterId={user.role === "SUPER_ADMIN" ? undefined : user.chapterId}
      />
    </div>
  );
}
