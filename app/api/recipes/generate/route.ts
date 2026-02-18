import { NextResponse } from "next/server";
import { listPantryItems } from "@/lib/db/pantry";
import { generateRecipeRequestSchema } from "@/lib/domain/recipes";
import { generateRecipes } from "@/lib/llm/generateRecipes";

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = generateRecipeRequestSchema.safeParse({
    maxTime: json.maxTime ? Number(json.maxTime) : undefined,
    cuisine: json.cuisine,
    dietaryNotes: json.dietaryNotes
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pantryItems = await listPantryItems();
  const result = await generateRecipes(pantryItems, parsed.data);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ recipes: result.recipes });
}
