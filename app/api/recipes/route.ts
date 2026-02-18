import { NextResponse } from "next/server";
import { z } from "zod";
import { listRecipes, saveRecipe } from "@/lib/db/recipes";

const saveRecipeSchema = z.object({
  title: z.string().trim().min(1),
  ingredients: z.array(z.string().trim().min(1)).min(1),
  steps: z.array(z.string().trim().min(1)).min(1),
  notes: z.string().trim().optional(),
  promptJson: z.string().trim().min(2)
});

export async function GET() {
  const recipes = await listRecipes();
  return NextResponse.json({ recipes });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = saveRecipeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const recipe = await saveRecipe(parsed.data);
  return NextResponse.json({ recipe }, { status: 201 });
}
