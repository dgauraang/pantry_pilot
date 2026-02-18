import { NextResponse } from "next/server";
import { deletePantryItem } from "@/lib/db/pantry";

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    await deletePantryItem(context.params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
}
