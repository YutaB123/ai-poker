import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Poker Room",
  description: "Watch AI models play five-card draw against each other.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
