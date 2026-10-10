import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  const file = join(process.cwd(), "public", "data", "nlp_insights.json");
  const data = JSON.parse(readFileSync(file, "utf-8"));
  return NextResponse.json(data);
}
