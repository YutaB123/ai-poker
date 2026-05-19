"use client";
import type { Card, Suit } from "@/lib/poker/cards";
import { rankShort, SUIT_GLYPH } from "@/lib/poker/cards";
import clsx from "clsx";

interface Props {
  card?: Card;
  faceDown?: boolean;
  highlight?: boolean;
  size?: "sm" | "md";
}

const suitColor: Record<Suit, string> = {
  c: "text-neutral-900",
  s: "text-neutral-900",
  d: "text-red-600",
  h: "text-red-600",
};

export function CardView({ card, faceDown, highlight, size = "md" }: Props) {
  const dims = size === "sm" ? "w-9 h-12 text-sm" : "w-12 h-16 text-lg";

  if (faceDown || !card) {
    return <div className={clsx("card-back rounded-md", dims, highlight && "ring-2 ring-yellow-300")} />;
  }
  return (
    <div
      className={clsx(
        "card-face rounded-md flex flex-col items-center justify-center font-bold leading-none",
        dims,
        suitColor[card.suit],
        highlight && "ring-2 ring-yellow-300"
      )}
    >
      <div>{rankShort(card.rank)}</div>
      <div className="text-xl">{SUIT_GLYPH[card.suit]}</div>
    </div>
  );
}
