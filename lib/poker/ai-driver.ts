import type { PlayerState, BetAction } from "./types";
import { cardsString } from "./cards";
import { getProvider, collectCompletion } from "../providers/registry";
import type { ProviderMessage } from "../providers/types";

interface BetDecision {
  action: BetAction;
  reasoning?: string;
}

interface DiscardDecision {
  indices: number[];
  reasoning?: string;
}

export async function decideBet(args: {
  player: PlayerState;
  allPlayers: PlayerState[];
  pot: number;
  currentBet: number;
  toCall: number;
  minBet: number;
  phase: "bet1" | "bet2";
}): Promise<BetDecision> {
  const { player, allPlayers, pot, currentBet, toCall, minBet, phase } = args;

  const others = allPlayers
    .filter((p) => p.seat !== player.seat)
    .map((p) => {
      const status = p.folded ? "FOLDED" : p.allIn ? "all-in" : "in";
      return `  - Seat ${p.seat} (${p.name}): ${status}, chips ${p.chips}, committed this hand ${p.committed}`;
    })
    .join("\n");

  const minRaiseTo = Math.max(currentBet + minBet, minBet);
  const maxRaiseTo = player.betThisRound + player.chips;

  const sys = `You are an AI playing Five-Card Draw poker. You will be given the table state and your hand, and must respond with a single JSON object describing your action. No prose outside the JSON.`;
  const user =
    `BETTING PHASE: ${phase === "bet1" ? "pre-draw" : "post-draw"}\n` +
    `Your seat: ${player.seat} (${player.name})\n` +
    `Your hand: ${cardsString(player.hand)}\n` +
    `Your chips: ${player.chips}\n` +
    `Your bet this round so far: ${player.betThisRound}\n` +
    `Current pot: ${pot}\n` +
    `Current bet to match this round: ${currentBet}\n` +
    `Chips needed to call: ${toCall}\n` +
    `Minimum bet/raise: ${minBet}\n` +
    `\n` +
    `Other players:\n${others || "  (none)"}\n` +
    `\n` +
    `Reply with ONE JSON object. Allowed shapes:\n` +
    (toCall === 0 ? `  {"action":"check","reasoning":"..."}\n` : `  {"action":"fold","reasoning":"..."}\n  {"action":"call","reasoning":"..."}\n`) +
    (toCall > 0 ? `  {"action":"fold","reasoning":"..."}\n` : "") +
    `  {"action":"raise","amount":<integer total bet target, >= ${minRaiseTo} and <= ${maxRaiseTo}>,"reasoning":"..."}\n` +
    (player.chips > 0 ? `  {"action":"all-in","reasoning":"..."}\n` : "") +
    `\nKeep reasoning under 20 words. Output only the JSON, no markdown fences.`;

  const raw = await callModel(player, [
    { role: "system", content: sys },
    { role: "user", content: user },
  ], 200);

  const parsed = parseJson(raw);
  if (!parsed) return { action: toCall > 0 ? { kind: "fold" } : { kind: "check" }, reasoning: "(unparseable reply)" };

  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 200) : undefined;
  const a = String(parsed.action ?? "").toLowerCase();
  switch (a) {
    case "fold": return { action: { kind: "fold" }, reasoning };
    case "check": return { action: { kind: "check" }, reasoning };
    case "call": return { action: { kind: "call" }, reasoning };
    case "all-in":
    case "allin":
    case "all_in":
      return { action: { kind: "all-in" }, reasoning };
    case "raise":
    case "bet": {
      const amount = Number(parsed.amount ?? parsed.to ?? parsed.toAmount);
      if (!Number.isFinite(amount)) {
        return { action: toCall > 0 ? { kind: "call" } : { kind: "check" }, reasoning };
      }
      return { action: { kind: "raise", toAmount: Math.floor(amount) }, reasoning };
    }
    default:
      return { action: toCall > 0 ? { kind: "fold" } : { kind: "check" }, reasoning: "(unknown action)" };
  }
}

export async function decideDiscard(args: {
  player: PlayerState;
  allPlayers: PlayerState[];
  pot: number;
}): Promise<DiscardDecision> {
  const { player, allPlayers, pot } = args;
  const indexed = player.hand.map((c, i) => `[${i}] ${c.rank === 10 ? "T" : c.rank}${c.suit}`).join(" ");
  const others = allPlayers
    .filter((p) => p.seat !== player.seat && !p.folded)
    .map((p) => `  - Seat ${p.seat} (${p.name}): chips ${p.chips}, committed ${p.committed}`)
    .join("\n");

  const sys = `You are an AI playing Five-Card Draw poker. You will be given your hand and must decide which cards (if any) to discard. Reply with a single JSON object only.`;
  const user =
    `DISCARD PHASE\n` +
    `Your seat: ${player.seat} (${player.name})\n` +
    `Your hand (indexed): ${indexed}\n` +
    `Pot: ${pot}\n` +
    `Players still in:\n${others || "  (none)"}\n` +
    `\n` +
    `Reply with ONE JSON object:\n` +
    `  {"discard":[<indices 0-4, up to 5 entries, may be empty>],"reasoning":"..."}\n` +
    `\nKeep reasoning under 20 words. Output only the JSON.`;

  const raw = await callModel(player, [
    { role: "system", content: sys },
    { role: "user", content: user },
  ], 200);

  const parsed = parseJson(raw);
  if (!parsed) return { indices: [], reasoning: "(unparseable reply)" };
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 200) : undefined;
  const arr = Array.isArray(parsed.discard) ? parsed.discard : [];
  const indices: number[] = [];
  for (const v of arr) {
    const n = Number(v);
    if (Number.isInteger(n)) indices.push(n);
  }
  return { indices, reasoning };
}

async function callModel(player: PlayerState, messages: ProviderMessage[], maxTokens: number): Promise<string> {
  try {
    const provider = getProvider(player.provider);
    const text = await collectCompletion(provider, {
      model: player.model,
      messages,
      maxTokens,
    });
    return text;
  } catch (e: any) {
    return `{"action":"fold","reasoning":"provider error: ${(e?.message ?? String(e)).slice(0, 80)}"}`;
  }
}

function parseJson(text: string): any | null {
  if (!text) return null;
  // Strip markdown fences if present
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  // Try direct parse
  try {
    return JSON.parse(t);
  } catch {}
  // Try extracting first {...} block
  const m = t.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  return null;
}
