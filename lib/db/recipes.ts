import type { Recipe } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type SavedRecipeInput = {
  title: string;
  ingredients: string[];
  steps: string[];
  notes?: string;
  promptJson: string;
};

export type RecipeView = {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  createdAt: string;
};

export function toRecipeView(row: Recipe): RecipeView {
  return {
    id: row.id,
    title: row.title,
    ingredients: JSON.parse(row.ingredientsJson) as string[],
    steps: JSON.parse(row.stepsJson) as string[],
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString()
  };
}

export async function listRecipes(): Promise<RecipeView[]> {
  const rows = await prisma.recipe.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toRecipeView);
}

export async function getRecipeById(id: string): Promise<RecipeView | null> {
  const row = await prisma.recipe.findUnique({ where: { id } });
  return row ? toRecipeView(row) : null;
}

export async function saveRecipe(input: SavedRecipeInput): Promise<RecipeView> {
  const row = await prisma.recipe.create({
    data: {
      title: input.title,
      ingredientsJson: JSON.stringify(input.ingredients),
      stepsJson: JSON.stringify(input.steps),
      notes: input.notes,
      promptJson: input.promptJson
    }
  });

  return toRecipeView(row);
}
