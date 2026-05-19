"use client";
import { useEffect, useState } from "react";
import type { ProviderId } from "@/lib/providers/types";

const PROVIDER_META: Record<ProviderId, { letter: string; bg: string; fg: string; label: string }> = {
  openai:    { letter: "O", bg: "#10a37f", fg: "#ffffff", label: "OpenAI" },
  anthropic: { letter: "A", bg: "#d97757", fg: "#ffffff", label: "Anthropic" },
  gemini:    { letter: "G", bg: "#4285f4", fg: "#ffffff", label: "Google" },
  grok:      { letter: "X", bg: "#000000", fg: "#ffffff", label: "xAI" },
};

export function ProviderLogo({ provider, size = 32 }: { provider: ProviderId; size?: number }) {
  const meta = PROVIDER_META[provider];
  const [customSrc, setCustomSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const ext of ["svg", "png", "jpg", "jpeg", "webp"]) {
        const url = `/logos/${provider}.${ext}`;
        try {
          const r = await fetch(url, { method: "HEAD" });
          if (r.ok && !cancelled) {
            setCustomSrc(url);
            return;
          }
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [provider]);

  if (customSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={customSrc}
        alt={meta.label}
        title={meta.label}
        style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      title={meta.label}
      style={{
        width: size, height: size, borderRadius: size / 2,
        background: meta.bg, color: meta.fg,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontFamily: "ui-sans-serif, system-ui",
        fontSize: Math.round(size * 0.5), lineHeight: 1, flexShrink: 0,
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }}
    >{meta.letter}</div>
  );
}
