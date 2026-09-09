"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ClientApiError } from "@/lib/api-client";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) return setError("New passwords do not match");
    setBusy(true);
    try {
      await api("/auth/change-password", { method: "POST", json: { currentPassword: current, newPassword: next } });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      if (err instanceof ClientApiError) {
        const first = err.body.fields ? Object.values(err.body.fields)[0]?.[0] : undefined;
        setError(first ?? err.message);
      } else setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <div className="space-y-1">
        <Label htmlFor="current">Current password</Label>
        <Input
          id="current"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="next">New password</Label>
        <Input
          id="next"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {done && <p className="text-sm text-green-700">Password updated.</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
