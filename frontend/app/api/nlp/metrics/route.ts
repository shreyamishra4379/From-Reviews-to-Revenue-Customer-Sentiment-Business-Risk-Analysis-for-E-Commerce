import { NextResponse } from 'next/server';
import { readJson } from '@/lib/server/data';
import path from 'path';

function getDataDir(): string {
  return path.join(path.resolve(process.cwd(), '..'), 'data', 'processed');
}

export async function GET(): Promise<NextResponse> {
  try {
    const metrics = readJson(path.join(getDataDir(), 'nlp_summary_metrics.json'));
    if (!metrics) {
      return NextResponse.json({ error: 'Metrics not found' }, { status: 404 });
    }
    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 });
  }
}