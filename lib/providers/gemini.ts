import { GoogleGenerativeAI } from "@google/generative-ai";
import type { StreamChunk, StreamCompletionRequest, StreamingProvider } from "./types";

export function createGeminiProvider(opts: { apiKey: string }): StreamingProvider {
  const client = new GoogleGenerativeAI(opts.apiKey);

  return {
    id: "gemini",
    async *streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk> {
      try {
        const systemPart = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
        const history = req.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));

        const model = client.getGenerativeModel({
          model: req.model,
          systemInstruction: systemPart || undefined,
          generationConfig: {
            maxOutputTokens: req.maxTokens,
            thinkingConfig: { thinkingBudget: 0 },
          } as any,
        });

        const result = await model.generateContentStream({ contents: history });
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text && text.length > 0) {
            yield { type: "text", text };
          }
        }
      } catch (e: any) {
        yield { type: "error", message: e?.message ?? String(e) };
      }
    },
  };
}
