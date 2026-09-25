import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { searchPlaces } from "@/lib/cities";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return ok({ places: searchPlaces(q) });
}
