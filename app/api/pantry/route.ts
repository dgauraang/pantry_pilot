import { NextResponse } from "next/server";
import { z } from "zod";
import { createPantryItem, listPantryItems } from "@/lib/db/pantry";

const createPantrySchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.string().trim().optional(),
  unit: z.string().trim().optional()
});

export async function GET() {
  const items = await listPantryItems();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createPantrySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await createPantryItem(parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}
