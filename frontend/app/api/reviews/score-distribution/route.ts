import { NextResponse } from 'next/server';
import { readJson } from '@/lib/server/data';
import path from 'path';

function getDataDir(): string {
  return path.join(path.resolve(process.cwd(), '..'), 'data', 'processed');
}

export async function GET(): Promise<NextResponse> {
  try {
    const distPath = path.join(getDataDir(), 'review_score_distribution.json');
    const data = readJson(distPath);
    if (!data) {
      return NextResponse.json({ error: 'Score distribution not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to load score distribution' }, { status: 500 });
  }
}