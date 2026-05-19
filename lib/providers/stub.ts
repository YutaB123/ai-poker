import type { ProviderId, StreamChunk, StreamCompletionRequest, StreamingProvider } from "./types";

export interface StubScript {
  chunks: string[];
}

let scripts: Record<string, StubScript> = {};

export function setStubScript(model: string, script: StubScript) {
  scripts[model] = script;
}

export function clearStubScripts() {
  scripts = {};
}

export function createStubProvider(id: ProviderId): StreamingProvider {
  return {
    id,
    async *streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk> {
      const script = scripts[req.model];
      if (script) {
        for (const c of script.chunks) yield { type: "text", text: c };
        return;
      }
      // Default deterministic-ish stub for poker decisions: looks at the user
      // message and emits a plausible JSON answer so the engine keeps moving.
      const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
      yield { type: "text", text: stubReplyFor(lastUser, req.model) };
    },
  };
}

function stubReplyFor(prompt: string, model: string): string {
  // Hash the model+prompt to make decisions deterministic per (model, situation).
  let h = 0;
  for (const ch of model + "|" + prompt) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const r = Math.abs(h);

  if (prompt.includes("DISCARD PHASE")) {
    // Discard 0-3 random indices.
    const n = r % 4;
    const picks: number[] = [];
    for (let i = 0; i < n; i++) picks.push((r >> (i * 2)) % 5);
    const uniq = Array.from(new Set(picks)).sort();
    return JSON.stringify({ discard: uniq, reasoning: "stub" });
  }
  // Betting decision
  const roll = r % 10;
  if (roll < 2) return JSON.stringify({ action: "fold", reasoning: "stub" });
  if (roll < 7) return JSON.stringify({ action: "call", reasoning: "stub" });
  return JSON.stringify({ action: "raise", amount: 10 + (r % 30), reasoning: "stub" });
}
