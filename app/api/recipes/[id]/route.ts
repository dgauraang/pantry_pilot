import { NextResponse } from "next/server";
import { deleteRecipeById, getRecipeById } from "@/lib/db/recipes";

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

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    await deleteRecipeById(context.params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }
}
