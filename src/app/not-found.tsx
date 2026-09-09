import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist or you do not have access to it.</p>
      <Link href="/events" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Go to events
      </Link>
    </main>
  );
}
