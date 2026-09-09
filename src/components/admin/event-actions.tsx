"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ClientApiError } from "@/lib/api-client";
import type { EventDto } from "@/server/services/events";

type Props = { event: Pick<EventDto, "id" | "status" | "title">; afterChange?: () => void };

export function EventActions({ event, afterChange }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "publish" | "cancel") {
    setBusy(true);
    setError(null);
    try {
      await api(`/events/${event.id}/${action}`, { method: "POST" });
      setConfirmCancel(false);
      if (afterChange) afterChange();
      else router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/events/${event.id}/registrations`}>Registrations</Link>
      </Button>
      {event.status === "DRAFT" && (
        <Button size="sm" disabled={busy} onClick={() => run("publish")}>
          Publish
        </Button>
      )}
      {event.status !== "CANCELLED" && (
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmCancel(true)}>
          Cancel event
        </Button>
      )}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel “{event.title}”?</DialogTitle>
            <DialogDescription>
              Members will no longer be able to register. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep event
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => run("cancel")}>
              Cancel event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
