export type ProviderId = "openai" | "anthropic" | "gemini" | "grok";

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamCompletionRequest {
  model: string;
  messages: ProviderMessage[];
  maxTokens: number;
}

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "error"; message: string };

export interface StreamingProvider {
  id: ProviderId;
  streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk>;
}
