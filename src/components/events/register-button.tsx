"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
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
import { registrationHint } from "@/components/events/event-badges";

export function RegisterButton({ event }: { event: EventDto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = event.myRegistration;
  const started = new Date(event.startAt) <= new Date();

  async function run(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      await api(`/events/${event.id}/register`, { method });
      setConfirm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (mine) {
    const waitlisted = mine.status === "WAITLISTED";
    return (
      <div className="space-y-2">
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            waitlisted ? "border-amber-300 bg-amber-50 text-amber-900" : "border-green-300 bg-green-50 text-green-900"
          }`}
        >
          {waitlisted ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>
            {waitlisted
              ? `You're on the waitlist${event.waitlistPosition ? ` (position ${event.waitlistPosition})` : ""}`
              : "You're registered"}
            {mine.paymentStatus === "PENDING" && " · payment pending"}
            {mine.paymentStatus === "PAID" && " · paid"}
          </span>
        </div>
        {!started && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirm(true)}>
            {waitlisted ? "Leave waitlist" : "Cancel registration"}
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{waitlisted ? "Leave the waitlist?" : "Cancel your registration?"}</DialogTitle>
              <DialogDescription>
                {waitlisted
                  ? "You will lose your place in the queue."
                  : "Your seat will be released to the next person on the waitlist."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => run("DELETE")}>
                {waitlisted ? "Leave waitlist" : "Cancel registration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const full = event.spotsLeft === 0;
  return (
    <div className="space-y-2">
      <Button
        disabled={!event.registration.ok || busy}
        title={event.registration.ok ? undefined : registrationHint(event)}
        onClick={() => run("POST")}
      >
        {busy ? "Please wait…" : full ? "Join waitlist" : "Register"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
