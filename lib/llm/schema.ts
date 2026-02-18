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

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();
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
