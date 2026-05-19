import type { Card } from "./cards";
import type { ProviderId } from "../providers/types";

export interface PlayerConfig {
  seat: number;
  name: string;
  provider: ProviderId;
  model: string;
  brandColor: string;
}

export interface PlayerState extends PlayerConfig {
  chips: number;
  hand: Card[];
  folded: boolean;
  allIn: boolean;
  committed: number;     // total chips put in this hand
  betThisRound: number;  // chips put in this betting round
}

export type BetAction =
  | { kind: "check" }
  | { kind: "call" }
  | { kind: "fold" }
  | { kind: "raise"; toAmount: number }
  | { kind: "all-in" };

export type PokerEvent =
  | { type: "hand_start"; handNumber: number; dealerSeat: number; players: PlayerSnapshot[] }
  | { type: "ante"; seat: number; amount: number; chipsAfter: number; pot: number }
  | { type: "deal"; seat: number; cards: Card[] }
  | { type: "phase"; phase: "bet1" | "draw" | "bet2" | "showdown" }
  | { type: "action"; seat: number; action: BetAction; chipsAfter: number; pot: number; toCall: number; reasoning?: string }
  | { type: "discard"; seat: number; indices: number[]; reasoning?: string }
  | { type: "draw_cards"; seat: number; newCards: Card[]; finalHand: Card[] }
  | { type: "reveal"; seat: number; cards: Card[]; description: string }
  | { type: "pot_award"; seat: number; amount: number; chipsAfter: number; reason: string }
  | { type: "hand_end"; standings: { seat: number; chips: number }[] }
  | { type: "error"; seat?: number; message: string };

export interface PlayerSnapshot {
  seat: number;
  name: string;
  provider: ProviderId;
  model: string;
  brandColor: string;
  chips: number;
}

export interface TableConfig {
  players: PlayerConfig[];
  startingChips: number;
  ante: number;
  minBet: number;
}
