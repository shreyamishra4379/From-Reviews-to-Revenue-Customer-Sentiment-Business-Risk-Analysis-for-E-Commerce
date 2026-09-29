import { NextResponse } from 'next/server';
import { readJson } from '@/lib/server/data';
import path from 'path';

function getDataDir(): string {
  return path.join(process.cwd(), 'data', 'processed');
}

export async function GET(): Promise<NextResponse> {
  try {
    const aspects = readJson(path.join(getDataDir(), 'nlp_aspects.json'));
    if (!aspects) {
      return NextResponse.json({ error: 'Aspects not found' }, { status: 404 });
    }
    return NextResponse.json(aspects);
  } catch {
    return NextResponse.json({ error: 'Failed to load aspects' }, { status: 500 });
  }
}