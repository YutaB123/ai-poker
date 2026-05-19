import { freshDeck, shuffle, cardsString } from "./cards";
import type { Card } from "./cards";
import { evaluate5, compareHands } from "./evaluator";
import type { BetAction, PlayerState, PokerEvent, TableConfig } from "./types";
import { decideBet, decideDiscard } from "./ai-driver";

export interface RunHandOpts {
  config: TableConfig;
  players: PlayerState[];   // mutated in place (chip counts persist between hands)
  dealerSeat: number;
  handNumber: number;
  emit: (e: PokerEvent) => void;
}

export async function runHand(opts: RunHandOpts): Promise<void> {
  const { config, players, dealerSeat, handNumber, emit } = opts;

  // reset per-hand state
  for (const p of players) {
    p.hand = [];
    p.folded = false;
    p.allIn = false;
    p.committed = 0;
    p.betThisRound = 0;
    if (p.chips <= 0) p.folded = true; // can't play without chips
  }

  const active = () => players.filter((p) => !p.folded);
  const inHand = (p: PlayerState) => !p.folded;
  const stillContesting = () => active().filter((p) => !p.allIn);

  emit({
    type: "hand_start",
    handNumber,
    dealerSeat,
    players: players.map((p) => ({
      seat: p.seat,
      name: p.name,
      provider: p.provider,
      model: p.model,
      brandColor: p.brandColor,
      chips: p.chips,
    })),
  });

  // ANTE
  let pot = 0;
  for (const p of players) {
    if (p.folded) continue;
    const a = Math.min(config.ante, p.chips);
    p.chips -= a;
    p.committed += a;
    pot += a;
    if (p.chips === 0) p.allIn = true;
    emit({ type: "ante", seat: p.seat, amount: a, chipsAfter: p.chips, pot });
  }

  // SHUFFLE & DEAL
  const deck: Card[] = shuffle(freshDeck());
  for (const p of players) {
    if (p.folded) continue;
    p.hand = deck.splice(0, 5);
    emit({ type: "deal", seat: p.seat, cards: p.hand });
  }

  // Betting round 1
  emit({ type: "phase", phase: "bet1" });
  pot = await bettingRound({ players, dealerSeat, pot, minBet: config.minBet, phase: "bet1", emit });

  if (active().length === 1) {
    awardLastStanding(players, pot, emit);
    finish(players, emit);
    return;
  }

  // DRAW PHASE
  emit({ type: "phase", phase: "draw" });
  const seatOrder = orderedFromDealer(players, dealerSeat);
  for (const p of seatOrder) {
    if (p.folded || p.allIn) continue;
    const decision = await decideDiscard({ player: p, allPlayers: players, pot });
    const indices = sanitizeDiscardIndices(decision.indices);
    emit({ type: "discard", seat: p.seat, indices, reasoning: decision.reasoning });
    const newCards: Card[] = [];
    if (indices.length > 0) {
      // remove discarded cards (descending to preserve indices), then draw
      const keep: Card[] = [];
      for (let i = 0; i < p.hand.length; i++) {
        if (!indices.includes(i)) keep.push(p.hand[i]);
      }
      const drawn = deck.splice(0, indices.length);
      newCards.push(...drawn);
      p.hand = [...keep, ...drawn];
    }
    emit({ type: "draw_cards", seat: p.seat, newCards, finalHand: p.hand });
  }

  // Betting round 2
  emit({ type: "phase", phase: "bet2" });
  for (const p of players) p.betThisRound = 0;
  pot = await bettingRound({ players, dealerSeat, pot, minBet: config.minBet, phase: "bet2", emit });

  if (active().length === 1) {
    awardLastStanding(players, pot, emit);
    finish(players, emit);
    return;
  }

  // SHOWDOWN
  emit({ type: "phase", phase: "showdown" });
  for (const p of orderedFromDealer(players, dealerSeat)) {
    if (p.folded) continue;
    const rank = evaluate5(p.hand);
    emit({ type: "reveal", seat: p.seat, cards: p.hand, description: rank.description });
  }

  distributePots(players, emit);
  finish(players, emit);
}

function finish(players: PlayerState[], emit: (e: PokerEvent) => void) {
  emit({
    type: "hand_end",
    standings: players.map((p) => ({ seat: p.seat, chips: p.chips })),
  });
}

function awardLastStanding(players: PlayerState[], pot: number, emit: (e: PokerEvent) => void) {
  const winner = players.find((p) => !p.folded);
  if (!winner) return;
  winner.chips += pot;
  emit({
    type: "pot_award",
    seat: winner.seat,
    amount: pot,
    chipsAfter: winner.chips,
    reason: "all others folded",
  });
}

function orderedFromDealer(players: PlayerState[], dealerSeat: number): PlayerState[] {
  const n = players.length;
  const out: PlayerState[] = [];
  for (let i = 1; i <= n; i++) {
    const seat = (dealerSeat + i) % n;
    const p = players.find((x) => x.seat === seat);
    if (p) out.push(p);
  }
  return out;
}

function sanitizeDiscardIndices(idx: number[]): number[] {
  const set = new Set<number>();
  for (const i of idx) {
    if (Number.isInteger(i) && i >= 0 && i < 5) set.add(i);
  }
  return Array.from(set).sort((a, b) => a - b);
}

interface BettingRoundOpts {
  players: PlayerState[];
  dealerSeat: number;
  pot: number;
  minBet: number;
  phase: "bet1" | "bet2";
  emit: (e: PokerEvent) => void;
}

async function bettingRound(opts: BettingRoundOpts): Promise<number> {
  const { players, dealerSeat, minBet, emit, phase } = opts;
  let pot = opts.pot;
  let currentBet = 0;

  const order = orderedFromDealer(players, dealerSeat);
  // queue of seats that still need to act this round
  const queue: number[] = order.filter((p) => !p.folded && !p.allIn).map((p) => p.seat);

  while (queue.length > 0) {
    const seat = queue.shift()!;
    const p = players.find((x) => x.seat === seat)!;
    if (p.folded || p.allIn) continue;

    const active = players.filter((x) => !x.folded);
    if (active.length <= 1) break;

    const toCall = Math.max(0, currentBet - p.betThisRound);
    const decision = await decideBet({
      player: p,
      allPlayers: players,
      pot,
      currentBet,
      toCall,
      minBet,
      phase,
    });

    const applied = applyAction(p, decision, currentBet, minBet);
    if (applied.error) {
      emit({ type: "error", seat: p.seat, message: applied.error });
    }
    const chipsMoved = applied.chipsMoved;
    pot += chipsMoved;
    if (applied.raised) {
      currentBet = p.betThisRound;
      // every other still-active, non-all-in player needs to act again
      const others = orderedFromDealer(players, p.seat)
        .filter((x) => !x.folded && !x.allIn && x.seat !== p.seat)
        .map((x) => x.seat);
      // clear & rebuild queue: only "others" (the raiser doesn't act again until someone re-raises)
      queue.length = 0;
      queue.push(...others);
    }
    emit({
      type: "action",
      seat: p.seat,
      action: applied.normalized,
      chipsAfter: p.chips,
      pot,
      toCall,
      reasoning: decision.reasoning,
    });
  }

  return pot;
}

interface AppliedAction {
  normalized: BetAction;
  chipsMoved: number;
  raised: boolean;
  error?: string;
}

function applyAction(
  p: PlayerState,
  decision: { action: BetAction },
  currentBet: number,
  minBet: number
): AppliedAction {
  const toCall = Math.max(0, currentBet - p.betThisRound);
  let action = decision.action;

  // Coerce illegal actions to legal fallbacks
  if (action.kind === "check" && toCall > 0) {
    // can't check when facing a bet: fall through to call (or fold if no chips)
    action = p.chips >= toCall ? { kind: "call" } : { kind: "all-in" };
  }
  if (action.kind === "call" && toCall === 0) {
    action = { kind: "check" };
  }
  if (action.kind === "raise") {
    const target = action.toAmount;
    const minRaiseTarget = Math.max(currentBet + minBet, minBet);
    if (!Number.isFinite(target) || target < minRaiseTarget) {
      // invalid raise: treat as call/check
      action = toCall > 0 ? { kind: "call" } : { kind: "check" };
    }
  }

  switch (action.kind) {
    case "fold": {
      p.folded = true;
      return { normalized: action, chipsMoved: 0, raised: false };
    }
    case "check": {
      return { normalized: action, chipsMoved: 0, raised: false };
    }
    case "call": {
      const amt = Math.min(toCall, p.chips);
      p.chips -= amt;
      p.committed += amt;
      p.betThisRound += amt;
      if (p.chips === 0) p.allIn = true;
      return { normalized: { kind: "call" }, chipsMoved: amt, raised: false };
    }
    case "all-in": {
      const amt = p.chips;
      p.chips -= amt;
      p.committed += amt;
      p.betThisRound += amt;
      p.allIn = true;
      const raised = p.betThisRound > currentBet;
      return { normalized: { kind: "all-in" }, chipsMoved: amt, raised };
    }
    case "raise": {
      const target = action.toAmount;
      const additional = target - p.betThisRound;
      if (additional >= p.chips) {
        // not enough chips: convert to all-in
        const amt = p.chips;
        p.chips -= amt;
        p.committed += amt;
        p.betThisRound += amt;
        p.allIn = true;
        const raised = p.betThisRound > currentBet;
        return { normalized: { kind: "all-in" }, chipsMoved: amt, raised };
      }
      p.chips -= additional;
      p.committed += additional;
      p.betThisRound += additional;
      return { normalized: { kind: "raise", toAmount: target }, chipsMoved: additional, raised: true };
    }
  }
}

function distributePots(players: PlayerState[], emit: (e: PokerEvent) => void) {
  // Build pot tiers by unique committed levels among NOT-folded players
  const active = players.filter((p) => !p.folded);
  const levelSet = new Set<number>();
  for (const p of active) levelSet.add(p.committed);
  const levels = Array.from(levelSet).sort((a, b) => a - b);

  let prev = 0;
  for (const level of levels) {
    let pot = 0;
    for (const p of players) {
      pot += Math.max(0, Math.min(p.committed, level) - Math.min(p.committed, prev));
    }
    const eligible = active.filter((p) => p.committed >= level);
    if (eligible.length === 0 || pot === 0) {
      prev = level;
      continue;
    }
    // Best hand among eligible
    const scored = eligible.map((p) => ({ p, rank: evaluate5(p.hand) }));
    scored.sort((a, b) => compareHands(b.rank, a.rank));
    const best = scored[0].rank;
    const winners = scored.filter((s) => compareHands(s.rank, best) === 0).map((s) => s.p);
    const share = Math.floor(pot / winners.length);
    const remainder = pot - share * winners.length;
    for (let i = 0; i < winners.length; i++) {
      const give = share + (i === 0 ? remainder : 0);
      winners[i].chips += give;
      emit({
        type: "pot_award",
        seat: winners[i].seat,
        amount: give,
        chipsAfter: winners[i].chips,
        reason:
          levels.length === 1
            ? `wins with ${scored.find((s) => s.p === winners[i])!.rank.description}`
            : `wins side pot with ${scored.find((s) => s.p === winners[i])!.rank.description}`,
      });
    }
    prev = level;
  }
}

// Helpers exported for tests / driver
export const _internal = { applyAction, distributePots };
