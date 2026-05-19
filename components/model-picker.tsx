"use client";
import type { ModelDescriptor } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";
import { ProviderLogo } from "./provider-logo";

interface Props {
  seat: number;
  catalog: ModelDescriptor[];
  value: { provider: string; model: string };
  name: string;
  onModelChange: (m: ModelDescriptor) => void;
  onNameChange: (name: string) => void;
}

export function ModelPicker({ seat, catalog, value, name, onModelChange, onNameChange }: Props) {
  const current = catalog.find((c) => c.provider === value.provider && c.model === value.model);
  return (
    <div className="bg-neutral-900/60 border border-white/10 rounded-lg p-3 flex items-center gap-3">
      <ProviderLogo provider={(current?.provider ?? "openai") as ProviderId} size={24} />
      <div className="w-12 text-xs text-neutral-400">Seat {seat}</div>
      <input
        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm w-32"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={`Player ${seat + 1}`}
      />
      <select
        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm flex-1"
        value={`${value.provider}::${value.model}`}
        onChange={(e) => {
          const [provider, model] = e.target.value.split("::");
          const m = catalog.find((c) => c.provider === provider && c.model === model);
          if (m) onModelChange(m);
        }}
      >
        {catalog.map((m) => (
          <option key={`${m.provider}::${m.model}`} value={`${m.provider}::${m.model}`}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
