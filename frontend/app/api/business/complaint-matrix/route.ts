import { NextResponse } from 'next/server';
import { readCsv } from '@/lib/server/data';
import path from 'path';

function getS4Dir(): string {
  return path.join(path.resolve(process.cwd(), '..'), 'data', 'processed', 'stage4');
}

export async function GET(): Promise<NextResponse> {
  try {
    const data = readCsv(path.join(getS4Dir(), 'complaint_matrix.csv'));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to load complaint matrix' }, { status: 500 });
  }
}