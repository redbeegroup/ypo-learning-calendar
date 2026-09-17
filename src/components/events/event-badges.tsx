import { Badge } from "@/components/ui/badge";
import type { EventDto } from "@/server/services/events";

export function TypeBadge({ type }: { type: EventDto["eventType"] }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: type.color }}
    >
      {type.name}
    </span>
  );
}

export function ChapterBadge({ chapter }: { chapter: EventDto["hostChapter"] }) {
  return <Badge variant="secondary">{chapter.name}</Badge>;
}

export function PaymentBadge({ event }: { event: Pick<EventDto, "paymentType" | "price" | "currency"> }) {
  if (event.paymentType === "FREE") return <Badge className="bg-green-600 hover:bg-green-600">Free</Badge>;
  return (
    <Badge className="bg-amber-600 hover:bg-amber-600">
      {event.currency}{" "}
      {event.price?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
    </Badge>
  );
}

const STATUS_CLASSES: Record<EventDto["status"], string> = {
  DRAFT: "bg-slate-500 hover:bg-slate-500",
  PUBLISHED: "bg-blue-600 hover:bg-blue-600",
  CANCELLED: "bg-red-600 hover:bg-red-600",
};

export function StatusBadge({ status }: { status: EventDto["status"] }) {
  return <Badge className={STATUS_CLASSES[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

export function visibilityLabel(event: Pick<EventDto, "visibility" | "hostChapter" | "accessChapters">): string {
  switch (event.visibility) {
    case "REGIONAL":
      return "Open to all SEA members";
    case "LOCAL":
      return `Open to ${event.hostChapter.name} members`;
    case "CHAPTER_SPECIFIC":
      return `Open to ${event.accessChapters.map((c) => c.name).join(", ")} members`;
  }
}

export function registrationHint(
  event: Pick<EventDto, "registration" | "visibility" | "hostChapter" | "accessChapters" | "spotsLeft" | "status">,
): string {
  if (event.status === "CANCELLED") return "Event cancelled";
  if (event.registration.ok) {
    if (event.spotsLeft === 0) return "Full – waitlist available";
    if (event.spotsLeft !== null) return `${event.spotsLeft} spot${event.spotsLeft === 1 ? "" : "s"} left`;
    return "Open for registration";
  }
  switch (event.registration.reason) {
    case "NOT_IN_SCOPE":
      return "Not open to your chapter";
    case "NOT_OPEN_YET":
      return "Registration opens later";
    case "CLOSED":
      return "Registration closed";
    case "STARTED":
      return "Event has started";
    case "NOT_PUBLISHED":
      return "Not published";
  }
}
