import { NextResponse } from 'next/server';
import { executeSql } from '@/lib/server/data';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    const result = executeSql(query);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, data: [], rowCount: 0 },
      { status: 500 }
    );
  }
}