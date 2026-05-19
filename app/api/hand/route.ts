import { NextRequest } from "next/server";
import { runHand } from "@/lib/poker/engine";
import type { PlayerState, TableConfig, PokerEvent } from "@/lib/poker/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HandRequest {
  config: TableConfig;
  players: Array<{
    seat: number;
    name: string;
    provider: PlayerState["provider"];
    model: string;
    brandColor: string;
    chips: number;
  }>;
  dealerSeat: number;
  handNumber: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandRequest;

  const players: PlayerState[] = body.players.map((p) => ({
    seat: p.seat,
    name: p.name,
    provider: p.provider,
    model: p.model,
    brandColor: p.brandColor,
    chips: p.chips,
    hand: [],
    folded: false,
    allIn: false,
    committed: 0,
    betThisRound: 0,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: PokerEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // controller may already be closed
        }
      };

      try {
        await runHand({
          config: body.config,
          players,
          dealerSeat: body.dealerSeat,
          handNumber: body.handNumber,
          emit: send,
        });
      } catch (e: any) {
        send({ type: "error", message: e?.message ?? String(e) });
      } finally {
        controller.enqueue(encoder.encode(`event: end\ndata: {}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
