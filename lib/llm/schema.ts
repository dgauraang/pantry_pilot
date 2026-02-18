import { z } from "zod";

export const recipeSchema = z.object({
  title: z.string().min(1),
  ingredients: z.array(z.string().min(1)).min(1),
  steps: z.array(z.string().min(1)).min(1),
  notes: z.string().default("")
});

export const recipeResponseSchema = z.object({
  recipes: z.array(recipeSchema).min(1)
});

export type RecipeCandidate = z.infer<typeof recipeSchema>;
export type RecipeResponse = z.infer<typeof recipeResponseSchema>;

function stripThinkingBlocks(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/<\/?think>/gi, " ")
    .replace(/\r/g, "")
    .trim();
}

function extractJsonBlock(raw: string): string {
  const trimmed = stripThinkingBlocks(raw);
  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  return trimmed;
}

export function parseAndValidateRecipesJson(raw: string): RecipeResponse {
  const candidate = extractJsonBlock(raw);
  const parsed = JSON.parse(candidate) as unknown;
  return recipeResponseSchema.parse(parsed);
}

export function tryParseRecipesFromFreeform(raw: string): RecipeResponse | null {
  const text = stripThinkingBlocks(raw);
  if (!text) {
    return null;
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const recipes: RecipeCandidate[] = [];
  let current: RecipeCandidate | null = null;
  let mode: "ingredients" | "steps" | "none" = "none";

  function flushCurrent() {
    if (!current) {
      return;
    }
    if (current.title && current.ingredients.length > 0 && current.steps.length > 0) {
      recipes.push(current);
    }
    current = null;
    mode = "none";
  }

  for (const line of lines) {
    const recipeMatch = line.match(/^recipe\s*\d+\s*:\s*(.+)$/i);
    if (recipeMatch?.[1]) {
      flushCurrent();
      current = {
        title: recipeMatch[1].trim(),
        ingredients: [],
        steps: [],
        notes: ""
      };
      mode = "none";
      continue;
    }

    if (!current) {
      continue;
    }

    if (/^ingredients\b/i.test(line)) {
      mode = "ingredients";
      continue;
    }

    if (/^steps?\b/i.test(line)) {
      mode = "steps";
      continue;
    }

    const notesMatch = line.match(/^notes?\s*:\s*(.+)$/i);
    if (notesMatch?.[1]) {
      current.notes = notesMatch[1].trim();
      mode = "none";
      continue;
    }

    if (mode === "ingredients") {
      const ingredientMatch = line.match(/^[-*]\s+(.+)$/);
      if (ingredientMatch?.[1]) {
        current.ingredients.push(ingredientMatch[1].trim());
      }
      continue;
    }

    if (mode === "steps") {
      const stepMatch = line.match(/^(?:\d+[\.\)]\s+|[-*]\s+)(.+)$/);
      if (stepMatch?.[1]) {
        current.steps.push(stepMatch[1].trim());
      }
      continue;
    }
  }

  flushCurrent();

  if (recipes.length === 0) {
    return null;
  }

  const topRecipes = recipes.slice(0, 3);
  return recipeResponseSchema.parse({ recipes: topRecipes });
}
