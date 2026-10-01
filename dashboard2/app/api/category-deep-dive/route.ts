import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const confidence = searchParams.get("confidence");
  const lowN       = searchParams.get("low_n");

  const file = join(process.cwd(), "public", "data", "category_intelligence.json");
  const data = JSON.parse(readFileSync(file, "utf-8"));

  let cats = data.categories;
  if (confidence && confidence !== "all")
    cats = cats.filter((c: { confidence: string }) => c.confidence === confidence);
  if (lowN === "true")  cats = cats.filter((c: { low_n: boolean }) => c.low_n);
  if (lowN === "false") cats = cats.filter((c: { low_n: boolean }) => !c.low_n);

  return NextResponse.json({ ...data, categories: cats });
}
