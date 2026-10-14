import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventDto } from "@/server/services/events";
import { registrationHint } from "@/components/events/event-badges";

/**
 * Registration runs through CVent: the button opens the event's registration link in a new tab.
 * The in-app registration flow is kept in register-button-inapp.tsx but not shown.
 */
export function RegisterButton({ event }: { event: EventDto }) {
  if (!event.registration.ok) {
    return (
      <Button disabled title={registrationHint(event)}>
        Register
      </Button>
    );
  }
  if (!event.registrationUrl) {
    return (
      <Button disabled title="The registration link has not been added yet">
        Registration link to follow
      </Button>
    );
  }
  return (
    <Button asChild>
      <a href={event.registrationUrl} target="_blank" rel="noreferrer">
        Register <ExternalLink className="ml-1 h-4 w-4" />
      </a>
    </Button>
  );
}
