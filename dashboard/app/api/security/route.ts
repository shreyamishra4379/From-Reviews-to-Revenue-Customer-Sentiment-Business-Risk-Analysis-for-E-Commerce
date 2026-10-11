import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { verifyIntegrity } from "@/lib/security/integrity";
import { recentSecurityEvents, securityEventCounts } from "@/lib/security/audit";
import { LIMITS } from "@/lib/security/guard";
import { configuredProviders } from "@/lib/ai/providers";

// GET /api/security — security posture for the Security page:
// integrity check, recent security events, last penetration-test report,
// and fraud/counterfeit signals from the review text. Never returns secrets.

export const dynamic = "force-dynamic";

const ROOT = join(process.cwd(), "..");

function readJson(path: string): unknown {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : null;
}

export async function GET() {
  const security = readJson(join(process.cwd(), "public", "data", "security.json")) as { fraud_signals?: unknown } | null;
  return NextResponse.json({
    integrity: await verifyIntegrity(),
    events: recentSecurityEvents(50),
    event_counts: securityEventCounts(),
    pentest: readJson(join(ROOT, "reports", "security_report.json")),
    fraud_signals: security?.fraud_signals ?? null,
    controls: {
      rate_limits: Object.entries(LIMITS).map(([route, l]) => ({
        route, requests: l.requests, window_seconds: l.windowMs / 1000, max_kb: l.maxBytes / 1024,
      })),
      // Only whether a provider is configured, never the key itself.
      ai_providers: configuredProviders().map(p => p.label),
    },
  });
}
