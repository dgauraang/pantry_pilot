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

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractSourceUrl(promptJson: string): string | null {
  try {
    const parsed = JSON.parse(promptJson) as { sourceUrl?: unknown };
    if (typeof parsed.sourceUrl === "string" && parsed.sourceUrl.trim()) {
      return parsed.sourceUrl.trim();
    }
  } catch {
    // Ignore invalid promptJson and treat as no source URL.
  }

  return null;
}

export async function findDuplicateRecipe(input: SavedRecipeInput): Promise<RecipeView | null> {
  const rows = await prisma.recipe.findMany({ orderBy: { createdAt: "desc" } });
  const inputTitle = normalizeTitle(input.title);
  const inputSourceUrl = extractSourceUrl(input.promptJson);

  const duplicate = rows.find((row) => {
    const sameTitle = normalizeTitle(row.title) === inputTitle;
    if (sameTitle) {
      return true;
    }

    if (!inputSourceUrl) {
      return false;
    }

    const rowSourceUrl = extractSourceUrl(row.promptJson);
    return rowSourceUrl === inputSourceUrl;
  });

  return duplicate ? toRecipeView(duplicate) : null;
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

export async function deleteRecipeById(id: string): Promise<void> {
  await prisma.recipe.delete({ where: { id } });
}
