import Anthropic from "@anthropic-ai/sdk";
import type { StreamChunk, StreamCompletionRequest, StreamingProvider } from "./types";

export function createAnthropicProvider(opts: { apiKey: string }): StreamingProvider {
  const client = new Anthropic({ apiKey: opts.apiKey });

  return {
    id: "anthropic",
    async *streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk> {
      try {
        const systemMessages = req.messages.filter((m) => m.role === "system").map((m) => m.content);
        const nonSystem = req.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const stream = client.messages.stream({
          model: req.model,
          max_tokens: req.maxTokens,
          system: systemMessages.join("\n\n") || undefined,
          messages: nonSystem,
        });

        for await (const event of stream as any) {
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta" &&
            typeof event.delta.text === "string"
          ) {
            yield { type: "text", text: event.delta.text };
          }
        }
      } catch (e: any) {
        yield { type: "error", message: e?.message ?? String(e) };
      }
    },
  };
}
