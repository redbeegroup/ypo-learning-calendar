"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">Something went wrong</p>
      <h1 className="text-2xl font-semibold">We could not load this page</h1>
      <p className="text-muted-foreground">Please try again. If the problem continues, contact your chapter administrator.</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/events">Go to events</Link>
        </Button>
      </div>
    </main>
  );
}
