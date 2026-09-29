import { NextResponse } from 'next/server';
import { readJson } from '@/lib/server/data';
import path from 'path';

function getDataDir(): string {
  return path.join(process.cwd(), 'data', 'processed');
}

export async function GET(): Promise<NextResponse> {
  try {
    const metrics = readJson(path.join(getDataDir(), 'stage4', 'stage4_metrics.json'));
    if (!metrics) {
      return NextResponse.json({ error: 'Stage 4 metrics not found' }, { status: 404 });
    }
    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json({ error: 'Failed to load stage4 metrics' }, { status: 500 });
  }
}