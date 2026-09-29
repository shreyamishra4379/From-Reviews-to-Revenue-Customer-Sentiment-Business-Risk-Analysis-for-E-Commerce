import { NextResponse } from 'next/server';
import { readJson } from '@/lib/server/data';
import path from 'path';

function getDataDir(): string {
  return path.join(path.resolve(process.cwd(), '..'), 'data', 'processed');
}

export async function GET(): Promise<NextResponse> {
  try {
    const topics = readJson(path.join(getDataDir(), 'nlp_topics.json'));
    if (!topics) {
      return NextResponse.json({ error: 'Topics not found' }, { status: 404 });
    }
    return NextResponse.json(topics);
  } catch {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 });
  }
}