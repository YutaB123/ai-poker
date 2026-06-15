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
      <head>
        {/* Critical inline styles so the dark theme is applied instantly,
            even before the Tailwind bundle loads (avoids an unstyled flash
            on Render cold starts). */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              "html,body{margin:0;background:#0f1117;color:#f5f5f5;" +
              "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;}",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
