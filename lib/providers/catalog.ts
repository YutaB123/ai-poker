import type { ProviderId } from "./types";

export interface ModelDescriptor {
  provider: ProviderId;
  model: string;
  label: string;
  brandColor: string;
}

export const CATALOG: ModelDescriptor[] = [
  { provider: "openai",    model: "gpt-4o",                     label: "GPT-4o",             brandColor: "#10a37f" },
  { provider: "openai",    model: "gpt-4o-mini",                label: "GPT-4o mini",        brandColor: "#10a37f" },
  { provider: "anthropic", model: "claude-opus-4-7",            label: "Claude Opus 4.7",    brandColor: "#d97757" },
  { provider: "anthropic", model: "claude-sonnet-4-6",          label: "Claude Sonnet 4.6",  brandColor: "#d97757" },
  { provider: "anthropic", model: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5",   brandColor: "#d97757" },
  { provider: "gemini",    model: "gemini-2.5-flash",           label: "Gemini 2.5 Flash",   brandColor: "#4285f4" },
  { provider: "grok",      model: "grok-4",                     label: "Grok 4",             brandColor: "#1a1a1a" },
  { provider: "grok",      model: "grok-4-fast",                label: "Grok 4 Fast",        brandColor: "#1a1a1a" },
];

export function findModel(provider: ProviderId, model: string): ModelDescriptor | undefined {
  return CATALOG.find((m) => m.provider === provider && m.model === model);
}
