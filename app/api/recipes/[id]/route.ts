import { NextResponse } from "next/server";
import { getRecipeById } from "@/lib/db/recipes";

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const recipe = await getRecipeById(context.params.id);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json({ recipe });
}
