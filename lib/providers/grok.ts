import OpenAI from "openai";
import type { StreamChunk, StreamCompletionRequest, StreamingProvider } from "./types";

export function createGrokProvider(opts: { apiKey: string; baseURL?: string }): StreamingProvider {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL ?? "https://api.x.ai/v1",
  });

  return {
    id: "grok",
    async *streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk> {
      try {
        const stream = await client.chat.completions.create({
          model: req.model,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: req.maxTokens,
          stream: true,
        });
        for await (const event of stream as any) {
          const delta = event.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield { type: "text", text: delta };
          }
        }
      } catch (e: any) {
        yield { type: "error", message: e?.message ?? String(e) };
      }
    },
  };
}
