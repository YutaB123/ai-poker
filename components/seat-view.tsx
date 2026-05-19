"use client";
import { CardView } from "./card-view";
import { ProviderLogo } from "./provider-logo";
import type { Card } from "@/lib/poker/cards";
import type { ProviderId } from "@/lib/providers/types";
import clsx from "clsx";

export interface SeatProps {
  seat: number;
  name: string;
  provider: ProviderId;
  modelLabel: string;
  brandColor: string;
  chips: number;
  hand?: Card[];
  faceDown?: boolean;
  folded?: boolean;
  allIn?: boolean;
  active?: boolean;
  isDealer?: boolean;
  betThisRound?: number;
  lastAction?: string;
  reasoning?: string;
  showdownDescription?: string;
  wonAmount?: number;
}

export function SeatView(p: SeatProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border bg-black/60 backdrop-blur p-3 w-56 text-sm space-y-2 transition-transform",
        p.active && "ring-2 ring-yellow-300 scale-[1.02]",
        p.folded && "opacity-50 grayscale"
      )}
      style={{ borderColor: p.brandColor }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ProviderLogo provider={p.provider} size={28} />
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.name}</div>
            <div className="text-[10px] text-neutral-400 truncate">{p.modelLabel}</div>
          </div>
        </div>
        {p.isDealer && (
          <span className="text-[10px] bg-white text-black px-1.5 py-0.5 rounded-full font-bold">D</span>
        )}
      </div>

      <div className="flex gap-1 justify-center min-h-[64px] items-center">
        {p.hand && p.hand.length > 0 ? (
          p.hand.map((c, i) => (
            <CardView key={i} card={c} faceDown={p.faceDown && !p.showdownDescription} size="sm" />
          ))
        ) : (
          <span className="text-neutral-500 text-xs">— no cards —</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="text-neutral-400">chips </span>
          <span className="font-mono font-bold">{p.chips}</span>
        </div>
        {p.betThisRound ? (
          <div className="bg-yellow-500/20 text-yellow-200 px-2 py-0.5 rounded">
            bet {p.betThisRound}
          </div>
        ) : null}
      </div>

      {p.lastAction && (
        <div className="text-xs text-emerald-300 truncate">→ {p.lastAction}</div>
      )}
      {p.folded && <div className="text-xs text-red-400">folded</div>}
      {p.allIn && !p.folded && <div className="text-xs text-orange-300">all-in</div>}
      {p.showdownDescription && (
        <div className="text-xs text-amber-200 font-semibold">{p.showdownDescription}</div>
      )}
      {p.wonAmount ? (
        <div className="text-xs text-yellow-300 font-bold">+{p.wonAmount}</div>
      ) : null}
      {p.reasoning && (
        <div className="text-[10px] text-neutral-400 italic line-clamp-2">"{p.reasoning}"</div>
      )}
    </div>
  );
}
