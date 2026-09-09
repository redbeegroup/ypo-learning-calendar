import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold text-primary">YPO SEA Learning Calendar</h1>
      <p className="text-muted-foreground">Learning events across South East Asia chapters.</p>
      <Link href="/login" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
        Sign in
      </Link>
    </main>
  );
}
