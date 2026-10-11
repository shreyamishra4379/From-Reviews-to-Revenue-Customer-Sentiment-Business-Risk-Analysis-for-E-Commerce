import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

// Security event log: what was blocked or flagged, when, and from where.
// Kept in memory for the Security page and appended as JSON lines to
// dashboard/logs/security.log (gitignored) for later review.

export type SecurityEventType =
  | "sql_blocked"            // query rejected by the read-only validator
  | "sql_sandbox_denied"     // DuckDB refused file or setting access
  | "rate_limited"
  | "request_too_large"
  | "prompt_injection_suspected"
  | "integrity_mismatch";

export interface SecurityEvent {
  time: string;
  type: SecurityEventType;
  route: string;
  client: string;            // anonymised client id, never the raw IP
  detail: string;
}

const MAX_EVENTS = 200;
const LOG_DIR = join(process.cwd(), "logs");
const g = globalThis as unknown as { __securityEvents?: SecurityEvent[] };
const events = (g.__securityEvents ??= []);

// Never write secrets to the log, even if a user pastes one into a request.
const SECRET_PATTERNS = [/gsk_[A-Za-z0-9]{10,}/g, /AIza[0-9A-Za-z_-]{20,}/g, /sk-[A-Za-z0-9_-]{16,}/g];

export function redact(text: string): string {
  return SECRET_PATTERNS.reduce((t, p) => t.replace(p, "[REDACTED]"), text);
}

/** Short, non-reversible client id from the request (no raw IPs in logs). */
export function clientId(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  let h = 0;
  for (const ch of ip) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `client-${h.toString(16).padStart(8, "0")}`;
}

export function logSecurityEvent(type: SecurityEventType, route: string, client: string, detail: string): void {
  const event: SecurityEvent = {
    time: new Date().toISOString(),
    type,
    route,
    client,
    detail: redact(detail).slice(0, 300),
  };
  events.unshift(event);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  mkdir(LOG_DIR, { recursive: true })
    .then(() => appendFile(join(LOG_DIR, "security.log"), JSON.stringify(event) + "\n", "utf-8"))
    .catch(() => { /* logging must never break a request */ });
}

export function recentSecurityEvents(limit = 50): SecurityEvent[] {
  return events.slice(0, limit);
}

export function securityEventCounts(): Record<SecurityEventType, number> {
  const counts = {
    sql_blocked: 0, sql_sandbox_denied: 0, rate_limited: 0,
    request_too_large: 0, prompt_injection_suspected: 0, integrity_mismatch: 0,
  } as Record<SecurityEventType, number>;
  for (const e of events) counts[e.type]++;
  return counts;
}
