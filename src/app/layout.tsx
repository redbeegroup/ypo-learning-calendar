import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YPO SEA Learning Calendar",
  description: "Learning events across YPO South East Asia chapters",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
