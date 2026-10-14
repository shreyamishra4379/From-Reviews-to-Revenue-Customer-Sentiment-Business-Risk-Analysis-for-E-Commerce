// OpenAI-compatible chat providers: Groq (primary) and Gemini (fallback).
// Both expose POST {baseUrl}/chat/completions with the same request/stream format.

const MAX_ANSWER_TOKENS = Number(process.env.AI_MAX_TOKENS) || 2048;

export interface ProviderConfig {
  id: "groq" | "gemini";
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function configuredProviders(): ProviderConfig[] {
  const list: ProviderConfig[] = [];
  if (process.env.GROQ_API_KEY) {
    list.push({
      id: "groq",
      label: "Groq",
      baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    });
  }
  if (process.env.GEMINI_API_KEY) {
    list.push({
      id: "gemini",
      label: "Gemini",
      baseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    });
  }
  return list;
}

// Tool calls are kept as received (including provider-specific extra fields such as
// Gemini thought signatures) and sent back unchanged on the next request.
export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  [extra: string]: unknown;
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export interface RoundResult {
  content: string;
  toolCalls: ToolCall[];
}

/**
 * One streamed completion. Text deltas go to onText as they arrive; tool calls are
 * assembled from their deltas and returned at the end.
 */
export async function streamRound(
  p: ProviderConfig,
  messages: ChatMessage[],
  tools: ToolSpec[],
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<RoundResult> {
  let resp: Response;
  try {
    resp = await fetch(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: p.model,
        messages,
        tools,
        tool_choice: "auto",
        stream: true,
        temperature: 0.2,
        // Caps tokens per answer (reasoning included) so no single reply can burn the quota.
        max_tokens: MAX_ANSWER_TOKENS,
      }),
      signal,
    });
  } catch (e) {
    throw new ProviderError(`${p.label} request failed: ${e instanceof Error ? e.message : e}`);
  }
  if (!resp.ok || !resp.body) {
    const detail = (await resp.text().catch(() => "")).slice(0, 500);
    throw new ProviderError(`${p.label} returned HTTP ${resp.status}: ${detail}`, resp.status);
  }

  let content = "";
  const calls: ToolCall[] = [];
  const decoder = new TextDecoder();
  const reader = resp.body.getReader();
  let buffer = "";

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let chunk: { choices?: { delta?: Record<string, unknown> }[]; error?: { message?: string } };
    try {
      chunk = JSON.parse(data);
    } catch {
      return; // ignore keep-alive or partial noise
    }
    if (chunk.error) throw new ProviderError(`${p.label} stream error: ${chunk.error.message ?? "unknown"}`);
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      onText(delta.content);
    }
    const tcs = delta.tool_calls as (Record<string, unknown> & { index?: number })[] | undefined;
    for (const [pos, tc] of (tcs ?? []).entries()) {
      const i = typeof tc.index === "number" ? tc.index : calls.length > pos ? pos : calls.length;
      const fn = (tc.function ?? {}) as { name?: string; arguments?: string };
      const existing = calls[i];
      if (!existing) {
        const { index: _index, function: _fn, ...rest } = tc;
        calls[i] = {
          ...rest,
          id: (tc.id as string) || `call_${i}_${Date.now()}`,
          type: "function",
          function: { name: fn.name ?? "", arguments: fn.arguments ?? "" },
        };
      } else {
        if (fn.name) existing.function.name += fn.name;
        if (fn.arguments) existing.function.arguments += fn.arguments;
        for (const [k, v] of Object.entries(tc)) {
          if (!["index", "function", "id", "type"].includes(k) && v !== undefined) existing[k] = v;
        }
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handle(line);
  }
  if (buffer) handle(buffer);

  return { content, toolCalls: calls.filter(Boolean) };
}
