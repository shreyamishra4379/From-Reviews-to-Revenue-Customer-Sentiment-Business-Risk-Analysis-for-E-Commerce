import { NextResponse } from 'next/server';
import { readCsv } from '@/lib/server/data';
import path from 'path';

function getS4Dir(): string {
  return path.join(process.cwd(), 'data', 'processed', 'stage4');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
): Promise<NextResponse> {
  try {
    const { table } = await params;
    const allowedTables = [
      'category', 'seller', 'state', 'monthly', 'quarterly'
    ];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }
    const data = readCsv(path.join(getS4Dir(), `agg_${table}.csv`));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}