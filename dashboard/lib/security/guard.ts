import { NextResponse } from "next/server";
import { clientId, logSecurityEvent } from "./audit";

// Per-client sliding-window rate limits and request-size limits for the API routes
// that do real work (DuckDB queries, paid AI calls). In memory, per server process:
// enough for a single-instance dashboard; a multi-instance deployment would need a
// shared store such as Redis.

export const LIMITS = {
  // Every chat message (most greetings and off-topic ones are answered locally, for free)
  "/api/chat":        { requests: 60, windowMs: 60_000, maxBytes: 64 * 1024 },
  // Chat messages that actually reach Groq / Gemini
  "/api/chat:ai":     { requests: 10, windowMs: 60_000, maxBytes: 64 * 1024 },
  "/api/sql/execute": { requests: 30, windowMs: 60_000, maxBytes: 16 * 1024 },
} as const;
type Route = keyof typeof LIMITS;

const g = globalThis as unknown as { __rateWindows?: Map<string, number[]>; __rateLogged?: Map<string, number> };
const windows = (g.__rateWindows ??= new Map());
// Last time a rate-limit event was logged per client: one log line per window, so a
// flood cannot fill the security log and bury other events.
const lastLogged = (g.__rateLogged ??= new Map());

/**
 * Returns a ready error response if the request must be refused, or null to continue.
 * Also returns the anonymised client id for later security logging.
 */
export function guardRequest(req: Request, route: Route): { blocked: NextResponse | null; client: string } {
  const client = clientId(req);
  const limit = LIMITS[route];

  const size = Number(req.headers.get("content-length") ?? 0);
  if (size > limit.maxBytes) {
    logSecurityEvent("request_too_large", route, client, `${size} bytes (limit ${limit.maxBytes})`);
    return {
      client,
      blocked: NextResponse.json({ error: `Request too large. The limit is ${limit.maxBytes / 1024} KB.` }, { status: 413 }),
    };
  }

  const now = Date.now();
  const key = `${route}|${client}`;
  const recent = (windows.get(key) ?? []).filter((t: number) => now - t < limit.windowMs);
  if (recent.length >= limit.requests) {
    const retry = Math.ceil((limit.windowMs - (now - recent[0])) / 1000);
    windows.set(key, recent);
    if (now - (lastLogged.get(key) ?? 0) >= limit.windowMs) {
      lastLogged.set(key, now);
      logSecurityEvent("rate_limited", route, client,
        `More than ${limit.requests} requests in ${limit.windowMs / 1000}s; further refusals in this window are not logged`);
    }
    return {
      client,
      blocked: NextResponse.json(
        { error: `Too many requests. Try again in ${retry} seconds.` },
        { status: 429, headers: { "Retry-After": String(retry) } },
      ),
    };
  }
  recent.push(now);
  windows.set(key, recent);
  return { client, blocked: null };
}
