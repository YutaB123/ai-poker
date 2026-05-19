export type Suit = "c" | "d" | "h" | "s";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ["c", "d", "h", "s"];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_GLYPH: Record<Suit, string> = {
  c: "♣",
  d: "♦",
  h: "♥",
  s: "♠",
};

export function rankShort(r: Rank): string {
  if (r === 14) return "A";
  if (r === 13) return "K";
  if (r === 12) return "Q";
  if (r === 11) return "J";
  if (r === 10) return "T";
  return String(r);
}

export function rankName(r: Rank): string {
  switch (r) {
    case 14: return "Ace";
    case 13: return "King";
    case 12: return "Queen";
    case 11: return "Jack";
    case 10: return "Ten";
    case 9: return "Nine";
    case 8: return "Eight";
    case 7: return "Seven";
    case 6: return "Six";
    case 5: return "Five";
    case 4: return "Four";
    case 3: return "Three";
    case 2: return "Two";
  }
}

export function cardString(c: Card): string {
  return `${rankShort(c.rank)}${c.suit}`;
}

export function cardsString(cards: Card[]): string {
  return cards.map(cardString).join(" ");
}

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push({ rank: r, suit: s });
  return deck;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
