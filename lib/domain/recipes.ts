import { z } from "zod";

export const generateRecipeRequestSchema = z.object({
  maxTime: z.number().int().positive().max(360).optional(),
  cuisine: z.string().trim().max(100).optional(),
  dietaryNotes: z.string().trim().max(400).optional()
});

export type GenerateRecipeRequest = z.infer<typeof generateRecipeRequestSchema>;

export type PantryForPrompt = {
  name: string;
  quantity?: string | null;
  unit?: string | null;
};

export function buildRecipePromptContext(
  pantryItems: PantryForPrompt[],
  constraints: GenerateRecipeRequest
): string {
  const pantryText = pantryItems
    .map((item) => {
      const qty = item.quantity?.trim() ? `${item.quantity} ` : "";
      const unit = item.unit?.trim() ? `${item.unit} ` : "";
      return `- ${qty}${unit}${item.name}`.trim();
    })
    .join("\n");

  return [
    `Pantry items:\n${pantryText || "- No pantry items provided."}`,
    `Constraints:`,
    `- Max time: ${constraints.maxTime ? `${constraints.maxTime} minutes` : "not set"}`,
    `- Cuisine: ${constraints.cuisine || "not set"}`,
    `- Dietary notes: ${constraints.dietaryNotes || "not set"}`
  ].join("\n");
}
