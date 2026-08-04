import { NextResponse } from "next/server";
import { searchSymbol } from "../../../lib/yahoo";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchSymbol(q.trim());
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ results: [], error: err.message }, { status: 200 });
  }
}
