import { NextRequest } from "next/server";
import {
  configuredProviders, streamRound, ProviderError,
  type ChatMessage, type ProviderConfig,
} from "@/lib/ai/providers";
import { TOOL_SPECS, executeTool } from "@/lib/ai/tools";
import { systemPrompt } from "@/lib/ai/prompt";

// POST /api/chat
// Body: { messages: { role: "user" | "assistant", content: string }[] }
// Streams newline-delimited JSON events:
//   { type: "provider", id, label, model, fallback }
//   { type: "text", delta }
//   { type: "tool", name, input, ok, summary, preview? }
//   { type: "error", message }
//   { type: "done" }
//
// Groq is tried first; if it fails before producing any answer text, the whole turn is
// restarted on Gemini (tool history is not carried across providers).

export const runtime = "nodejs";

const MAX_TOOL_ROUNDS = 6;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;

type Emit = (event: Record<string, unknown>) => void;

class TextAlreadySentError extends Error {}

async function runTurn(p: ProviderConfig, base: ChatMessage[], emit: Emit, signal: AbortSignal) {
  const messages = [...base];
  let sentText = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // On the last round tools are withheld so the model has to answer.
    const tools = round < MAX_TOOL_ROUNDS ? TOOL_SPECS : [];
    let result;
    try {
      result = await streamRound(p, messages, tools, delta => {
        sentText = true;
        emit({ type: "text", delta });
      }, signal);
    } catch (e) {
      if (sentText) throw new TextAlreadySentError(e instanceof Error ? e.message : String(e));
      throw e;
    }

    if (result.toolCalls.length === 0) {
      if (!result.content.trim() && !sentText) throw new ProviderError(`${p.label} returned an empty answer`);
      return;
    }

    messages.push({ role: "assistant", content: result.content || null, tool_calls: result.toolCalls });
    for (const call of result.toolCalls) {
      const outcome = executeTool(call.function.name, call.function.arguments);
      let input: unknown = call.function.arguments;
      try { input = JSON.parse(call.function.arguments); } catch { /* show raw */ }
      emit({ type: "tool", name: call.function.name, input, ok: outcome.ok,
             summary: outcome.summary, preview: outcome.preview });
      messages.push({ role: "tool", tool_call_id: call.id, content: outcome.output });
    }
    if (result.content) emit({ type: "text", delta: "\n\n" });
  }
}

export async function POST(req: NextRequest) {
  const providers = configuredProviders();
  if (providers.length === 0) {
    return Response.json(
      { error: "No AI provider configured. Add GROQ_API_KEY and/or GEMINI_API_KEY to dashboard/.env.local and restart the server." },
      { status: 503 },
    );
  }

  let body: { messages?: { role?: string; content?: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const history: ChatMessage[] = (body.messages ?? [])
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content!.slice(0, MAX_MESSAGE_CHARS) }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "The last message must be from the user" }, { status: 400 });
  }

  let system: string;
  try {
    system = systemPrompt();
  } catch (e) {
    return Response.json({ error: `Could not load the data schema: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }
  const base: ChatMessage[] = [{ role: "system", content: system }, ...history];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = event => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const failures: string[] = [];
      try {
        for (const [i, p] of providers.entries()) {
          emit({ type: "provider", id: p.id, label: p.label, model: p.model, fallback: i > 0 });
          try {
            await runTurn(p, base, emit, req.signal);
            failures.length = 0;
            break;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[chat] ${p.label} failed: ${msg}`);
            failures.push(msg);
            // Part of the answer is already on screen; switching provider would duplicate it.
            if (e instanceof TextAlreadySentError || req.signal.aborted) break;
          }
        }
        if (failures.length) {
          emit({ type: "error", message: failures.join(" | ").slice(0, 800) });
        }
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
