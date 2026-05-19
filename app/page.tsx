"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ModelPicker } from "@/components/model-picker";
import { SeatView, SeatProps } from "@/components/seat-view";
import { ActionLog, LogEntry } from "@/components/action-log";
import type { ModelDescriptor } from "@/lib/providers/catalog";
import type { Card } from "@/lib/poker/cards";
import type { PokerEvent } from "@/lib/poker/types";
import { rankShort, SUIT_GLYPH } from "@/lib/poker/cards";
import type { ProviderId } from "@/lib/providers/types";

const SEAT_COUNT = 6;
const STARTING_CHIPS = 500;
const ANTE = 5;
const MIN_BET = 10;

interface SeatConfig {
  provider: ProviderId;
  model: string;
  brandColor: string;
  name: string;
  modelLabel: string;
}

interface RuntimeSeat {
  chips: number;
  hand: Card[];
  hideCards: boolean;
  folded: boolean;
  allIn: boolean;
  betThisRound: number;
  lastAction?: string;
  reasoning?: string;
  showdownDescription?: string;
  wonAmount: number;
}

function fmtCard(c: Card) {
  return `${rankShort(c.rank)}${SUIT_GLYPH[c.suit]}`;
}

function fmtCards(cs: Card[]) {
  return cs.map(fmtCard).join(" ");
}

export default function HomePage() {
  const [catalog, setCatalog] = useState<ModelDescriptor[]>([]);
  const [seats, setSeats] = useState<SeatConfig[]>([]);
  const [phase, setPhase] = useState<"setup" | "table">("setup");

  // Running-table state
  const [runtime, setRuntime] = useState<RuntimeSeat[]>([]);
  const [pot, setPot] = useState(0);
  const [dealerSeat, setDealerSeat] = useState(0);
  const [handNumber, setHandNumber] = useState(0);
  const [activeSeat, setActiveSeat] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  // Load catalog
  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((j: { models: ModelDescriptor[] }) => {
        setCatalog(j.models);
        // Default seat assignments — rotate through catalog
        const defaults: SeatConfig[] = [];
        for (let i = 0; i < SEAT_COUNT; i++) {
          const m = j.models[i % j.models.length];
          defaults.push({
            provider: m.provider,
            model: m.model,
            brandColor: m.brandColor,
            modelLabel: m.label,
            name: shortLabel(m.label),
          });
        }
        setSeats(defaults);
      });
  }, []);

  function pushLog(text: string, tone?: LogEntry["tone"]) {
    setLog((prev) => [...prev, { id: ++logIdRef.current, text, tone }]);
  }

  function startTable() {
    setRuntime(
      Array.from({ length: SEAT_COUNT }, () => ({
        chips: STARTING_CHIPS,
        hand: [],
        hideCards: true,
        folded: false,
        allIn: false,
        betThisRound: 0,
        wonAmount: 0,
      }))
    );
    setPot(0);
    setDealerSeat(0);
    setHandNumber(0);
    setLog([]);
    logIdRef.current = 0;
    setPhase("table");
  }

  async function dealHand() {
    if (running) return;
    setRunning(true);
    const nextHand = handNumber + 1;
    const nextDealer = handNumber === 0 ? 0 : (dealerSeat + 1) % SEAT_COUNT;
    setHandNumber(nextHand);
    setDealerSeat(nextDealer);

    // Reset per-hand visuals
    setRuntime((prev) =>
      prev.map((s) => ({
        ...s,
        hand: [],
        hideCards: true,
        folded: false,
        allIn: false,
        betThisRound: 0,
        lastAction: undefined,
        reasoning: undefined,
        showdownDescription: undefined,
        wonAmount: 0,
      }))
    );
    setPot(0);
    setActiveSeat(null);
    setCurrentPhase("");
    pushLog(`── Hand #${nextHand} — dealer is seat ${nextDealer} (${seats[nextDealer].name}) ──`, "phase");

    const body = {
      config: {
        players: [],
        startingChips: STARTING_CHIPS,
        ante: ANTE,
        minBet: MIN_BET,
      },
      players: seats.map((s, i) => ({
        seat: i,
        name: s.name || `Player ${i + 1}`,
        provider: s.provider,
        model: s.model,
        brandColor: s.brandColor,
        chips: runtime[i].chips,
      })),
      dealerSeat: nextDealer,
      handNumber: nextHand,
    };

    try {
      const res = await fetch("/api/hand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) throw new Error(`hand request failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const chunk of parts) {
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            let ev: PokerEvent;
            try {
              ev = JSON.parse(payload) as PokerEvent;
            } catch {
              continue;
            }
            await handleEvent(ev);
            // brief pacing so the user can follow
            await sleep(eventDelay(ev));
          }
        }
      }
    } catch (e: any) {
      pushLog(`error: ${e?.message ?? String(e)}`, "error");
    } finally {
      setActiveSeat(null);
      setRunning(false);
    }
  }

  async function handleEvent(ev: PokerEvent) {
    switch (ev.type) {
      case "hand_start": {
        for (const p of ev.players) {
          setRuntime((prev) => {
            const next = prev.slice();
            next[p.seat] = { ...next[p.seat], chips: p.chips };
            return next;
          });
        }
        break;
      }
      case "ante": {
        setPot(ev.pot);
        setRuntime((prev) => {
          const next = prev.slice();
          next[ev.seat] = { ...next[ev.seat], chips: ev.chipsAfter };
          return next;
        });
        break;
      }
      case "deal": {
        setRuntime((prev) => {
          const next = prev.slice();
          next[ev.seat] = { ...next[ev.seat], hand: ev.cards, hideCards: true };
          return next;
        });
        pushLog(`seat ${ev.seat} dealt 5 cards`);
        break;
      }
      case "phase": {
        const label =
          ev.phase === "bet1" ? "Pre-draw betting"
          : ev.phase === "draw" ? "Draw phase"
          : ev.phase === "bet2" ? "Post-draw betting"
          : "Showdown";
        setCurrentPhase(label);
        pushLog(`── ${label} ──`, "phase");
        if (ev.phase === "bet1" || ev.phase === "bet2") {
          // Reset bet-this-round indicators
          setRuntime((prev) => prev.map((s) => ({ ...s, betThisRound: 0 })));
        }
        break;
      }
      case "action": {
        setActiveSeat(ev.seat);
        setPot(ev.pot);
        const a = ev.action;
        const txt =
          a.kind === "fold" ? "folds"
          : a.kind === "check" ? "checks"
          : a.kind === "call" ? `calls ${ev.toCall}`
          : a.kind === "raise" ? `raises to ${a.toAmount}`
          : `all-in`;
        setRuntime((prev) => {
          const next = prev.slice();
          const s = next[ev.seat];
          next[ev.seat] = {
            ...s,
            chips: ev.chipsAfter,
            folded: a.kind === "fold" ? true : s.folded,
            allIn: a.kind === "all-in" ? true : s.allIn,
            betThisRound:
              a.kind === "call" ? s.betThisRound + ev.toCall :
              a.kind === "raise" ? a.toAmount :
              a.kind === "all-in" ? s.betThisRound + (s.chips) : // chips already decremented; we display new total via committed-ish proxy
              s.betThisRound,
            lastAction: txt,
            reasoning: ev.reasoning,
          };
          return next;
        });
        pushLog(`seat ${ev.seat} ${txt}${ev.reasoning ? ` — "${ev.reasoning}"` : ""}`, "action");
        break;
      }
      case "discard": {
        setActiveSeat(ev.seat);
        const n = ev.indices.length;
        setRuntime((prev) => {
          const next = prev.slice();
          next[ev.seat] = {
            ...next[ev.seat],
            lastAction: `discards ${n}`,
            reasoning: ev.reasoning,
          };
          return next;
        });
        pushLog(`seat ${ev.seat} discards ${n} card${n === 1 ? "" : "s"}${ev.reasoning ? ` — "${ev.reasoning}"` : ""}`, "action");
        break;
      }
      case "draw_cards": {
        setRuntime((prev) => {
          const next = prev.slice();
          next[ev.seat] = { ...next[ev.seat], hand: ev.finalHand };
          return next;
        });
        break;
      }
      case "reveal": {
        setActiveSeat(ev.seat);
        setRuntime((prev) => {
          const next = prev.slice();
          next[ev.seat] = {
            ...next[ev.seat],
            hideCards: false,
            showdownDescription: ev.description,
            hand: ev.cards,
          };
          return next;
        });
        pushLog(`seat ${ev.seat} shows ${fmtCards(ev.cards)} — ${ev.description}`, "info");
        break;
      }
      case "pot_award": {
        setRuntime((prev) => {
          const next = prev.slice();
          next[ev.seat] = {
            ...next[ev.seat],
            chips: ev.chipsAfter,
            wonAmount: (next[ev.seat].wonAmount ?? 0) + ev.amount,
          };
          return next;
        });
        setPot(0);
        pushLog(`seat ${ev.seat} ${ev.reason}, wins ${ev.amount}`, "win");
        break;
      }
      case "hand_end": {
        setActiveSeat(null);
        pushLog(`Hand complete.`, "phase");
        break;
      }
      case "error": {
        pushLog(`error${ev.seat !== undefined ? ` (seat ${ev.seat})` : ""}: ${ev.message}`, "error");
        break;
      }
    }
  }

  // Seat positions around an oval
  const seatPositions = useMemo(() => {
    // angles in degrees, starting bottom-center going clockwise so seat 0 is bottom
    const positions: Array<{ left: string; top: string }> = [];
    for (let i = 0; i < SEAT_COUNT; i++) {
      const angle = (90 - (360 * i) / SEAT_COUNT) * (Math.PI / 180);
      const x = 50 + 42 * Math.cos(angle);
      const y = 50 - 38 * Math.sin(angle);
      positions.push({ left: `${x}%`, top: `${y}%` });
    }
    return positions;
  }, []);

  if (phase === "setup") {
    return (
      <main className="min-h-screen p-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">AI Poker Room</h1>
        <p className="text-neutral-400 mb-6">
          Six AI models, five-card draw, no buy-in for humans. Pick your seats and watch them play.
        </p>

        <div className="space-y-2 mb-6">
          {seats.map((s, i) => (
            <ModelPicker
              key={i}
              seat={i}
              catalog={catalog}
              value={{ provider: s.provider, model: s.model }}
              name={s.name}
              onNameChange={(n) =>
                setSeats((prev) => prev.map((p, idx) => (idx === i ? { ...p, name: n } : p)))
              }
              onModelChange={(m) =>
                setSeats((prev) =>
                  prev.map((p, idx) =>
                    idx === i
                      ? {
                          ...p,
                          provider: m.provider,
                          model: m.model,
                          brandColor: m.brandColor,
                          modelLabel: m.label,
                          name: p.name && p.name !== prev[idx].name ? p.name : shortLabel(m.label),
                        }
                      : p
                  )
                )
              }
            />
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            disabled={seats.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 px-5 py-2 rounded-lg font-semibold"
            onClick={startTable}
          >
            Start table
          </button>
          <div className="text-xs text-neutral-500">
            {STARTING_CHIPS} chips each · ante {ANTE} · min bet {MIN_BET}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">AI Poker Room</h1>
          <p className="text-neutral-400 text-sm">
            Hand #{handNumber || "—"} · {currentPhase || "waiting"} · pot {pot}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={running}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 px-4 py-2 rounded-lg font-semibold"
            onClick={dealHand}
          >
            {running ? "Dealing…" : handNumber === 0 ? "Deal first hand" : "Deal next hand"}
          </button>
          <button
            disabled={running}
            className="bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 px-4 py-2 rounded-lg"
            onClick={() => setPhase("setup")}
          >
            Back to setup
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-4">
        <div className="relative felt-table rounded-[42%/30%] aspect-[16/10] w-full">
          {/* Pot indicator at center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 border border-white/10 rounded-xl px-5 py-3 text-center">
              <div className="text-xs text-neutral-400">POT</div>
              <div className="text-2xl font-bold text-yellow-300 font-mono">{pot}</div>
              {currentPhase && <div className="text-[10px] text-cyan-300 mt-1">{currentPhase}</div>}
            </div>
          </div>

          {seats.map((s, i) => {
            const rt = runtime[i] ?? {
              chips: 0, hand: [], hideCards: true, folded: false, allIn: false, betThisRound: 0, wonAmount: 0,
            } as RuntimeSeat;
            const pos = seatPositions[i];
            const isDealer = handNumber > 0 && i === dealerSeat;
            const props: SeatProps = {
              seat: i,
              name: s.name || `Player ${i + 1}`,
              provider: s.provider,
              modelLabel: s.modelLabel,
              brandColor: s.brandColor,
              chips: rt.chips,
              hand: rt.hand,
              faceDown: rt.hideCards && !isDealer,
              folded: rt.folded,
              allIn: rt.allIn,
              active: activeSeat === i,
              isDealer,
              betThisRound: rt.betThisRound,
              lastAction: rt.lastAction,
              reasoning: rt.reasoning,
              showdownDescription: rt.showdownDescription,
              wonAmount: rt.wonAmount,
            };
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={pos}
              >
                <SeatView {...props} />
              </div>
            );
          })}
        </div>

        <ActionLog entries={log} />
      </div>
    </main>
  );
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function eventDelay(ev: PokerEvent): number {
  switch (ev.type) {
    case "deal": return 100;
    case "ante": return 80;
    case "action": return 350;
    case "discard": return 350;
    case "draw_cards": return 200;
    case "reveal": return 600;
    case "pot_award": return 800;
    case "phase": return 400;
    default: return 80;
  }
}

function shortLabel(label: string): string {
  // "Claude Opus 4.7" -> "Opus 4.7"; "GPT-4o mini" -> "GPT-4o mini"; "Gemini 2.5 Flash" -> "Gemini"
  if (label.startsWith("Claude ")) return label.slice(7);
  if (label.startsWith("Gemini ")) return label.split(" ").slice(0, 2).join(" ");
  return label;
}
