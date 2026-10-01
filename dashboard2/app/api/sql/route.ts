import { NextResponse } from "next/server";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const SQL_DIR = join(process.cwd(), "..", "sql");

export async function GET() {
  try {
    const files = readdirSync(SQL_DIR)
      .filter(f => f.endsWith(".sql"))
      .sort();

    const queries = files.map(f => {
      const stem = f.replace(".sql", "");
      const parts = stem.split("_");
      // strip leading numeric prefix: "01_category_revenue" → "Category Revenue"
      const name = (parts[0].match(/^\d+$/) ? parts.slice(1) : parts)
        .join(" ")
        .replace(/\b\w/g, c => c.toUpperCase());
      const sql = readFileSync(join(SQL_DIR, f), "utf-8").trim();
      return { file: f, name, sql };
    });

    return NextResponse.json({ queries });
  } catch (err) {
    return NextResponse.json(
      { error: `Cannot read SQL directory: ${err}` },
      { status: 500 }
    );
  }
}
