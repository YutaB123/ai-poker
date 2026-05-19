"use client";
import { useEffect, useRef } from "react";

export interface LogEntry {
  id: number;
  text: string;
  tone?: "info" | "action" | "win" | "phase" | "error";
}

export function ActionLog({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  return (
    <div
      ref={ref}
      className="bg-black/70 rounded-xl border border-white/10 p-3 h-72 overflow-y-auto text-xs font-mono"
    >
      {entries.length === 0 && (
        <div className="text-neutral-500">Press "Deal hand" to begin.</div>
      )}
      {entries.map((e) => (
        <div
          key={e.id}
          className={
            e.tone === "phase"
              ? "text-cyan-300 font-bold mt-2"
              : e.tone === "win"
              ? "text-yellow-300 font-bold"
              : e.tone === "error"
              ? "text-red-400"
              : e.tone === "action"
              ? "text-emerald-300"
              : "text-neutral-200"
          }
        >
          {e.text}
        </div>
      ))}
    </div>
  );
}
