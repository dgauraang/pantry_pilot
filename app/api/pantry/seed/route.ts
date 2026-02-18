import { NextResponse } from "next/server";
import { seedPantryItems } from "@/lib/db/pantry";

export async function POST() {
  await seedPantryItems();
  return NextResponse.json({ ok: true });
}
