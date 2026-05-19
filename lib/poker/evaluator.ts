import type { Card, Rank } from "./cards";
import { rankName } from "./cards";

export interface HandRank {
  category: number;
  tiebreaks: number[];
  description: string;
}

export function evaluate5(cards: Card[]): HandRank {
  if (cards.length !== 5) throw new Error(`evaluate5 expects 5 cards, got ${cards.length}`);
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank) as Rank[];
  const suits = sorted.map((c) => c.suit);

  const flush = suits.every((s) => s === suits[0]);

  const unique = Array.from(new Set(ranks));
  let straight = false;
  let straightHigh: Rank | 0 = 0;
  if (unique.length === 5) {
    if (ranks[0] - ranks[4] === 4) {
      straight = true;
      straightHigh = ranks[0];
    } else if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
      straight = true;
      straightHigh = 5;
    }
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const grouped = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const top = grouped[0];
  const second = grouped[1];

  if (straight && flush) {
    return {
      category: 8,
      tiebreaks: [straightHigh as number],
      description: straightHigh === 14 ? "Royal flush" : `Straight flush, ${rankName(straightHigh as Rank)}-high`,
    };
  }
  if (top[1] === 4) {
    return {
      category: 7,
      tiebreaks: [top[0], second[0]],
      description: `Four of a kind, ${rankName(top[0] as Rank)}s`,
    };
  }
  if (top[1] === 3 && second[1] === 2) {
    return {
      category: 6,
      tiebreaks: [top[0], second[0]],
      description: `Full house, ${rankName(top[0] as Rank)}s full of ${rankName(second[0] as Rank)}s`,
    };
  }
  if (flush) {
    return {
      category: 5,
      tiebreaks: ranks.slice(),
      description: `Flush, ${rankName(ranks[0])}-high`,
    };
  }
  if (straight) {
    return {
      category: 4,
      tiebreaks: [straightHigh as number],
      description: `Straight, ${rankName(straightHigh as Rank)}-high`,
    };
  }
  if (top[1] === 3) {
    return {
      category: 3,
      tiebreaks: [top[0], second[0], grouped[2][0]],
      description: `Three of a kind, ${rankName(top[0] as Rank)}s`,
    };
  }
  if (top[1] === 2 && second[1] === 2) {
    const highPair = Math.max(top[0], second[0]);
    const lowPair = Math.min(top[0], second[0]);
    return {
      category: 2,
      tiebreaks: [highPair, lowPair, grouped[2][0]],
      description: `Two pair, ${rankName(highPair as Rank)}s and ${rankName(lowPair as Rank)}s`,
    };
  }
  if (top[1] === 2) {
    return {
      category: 1,
      tiebreaks: [top[0], second[0], grouped[2][0], grouped[3][0]],
      description: `Pair of ${rankName(top[0] as Rank)}s`,
    };
  }
  return {
    category: 0,
    tiebreaks: ranks.slice(),
    description: `${rankName(ranks[0])}-high`,
  };
}

export function compareHands(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreaks.length, b.tiebreaks.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreaks[i] ?? 0;
    const bv = b.tiebreaks[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
