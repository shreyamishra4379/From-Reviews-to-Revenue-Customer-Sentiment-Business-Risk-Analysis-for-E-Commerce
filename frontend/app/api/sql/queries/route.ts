import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getSqlDir(): string {
  return path.join(path.resolve(process.cwd(), '..'), 'sql');
}

export async function GET(): Promise<NextResponse> {
  try {
    const sqlDir = getSqlDir();
    const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();
    const queries = files.map(f => ({
      filename: f,
      content: fs.readFileSync(path.join(sqlDir, f), 'utf-8')
    }));
    return NextResponse.json(queries);
  } catch {
    return NextResponse.json({ error: 'Failed to load queries' }, { status: 500 });
  }
}