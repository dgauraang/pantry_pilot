import type OpenAI from "openai";
import { buildRecipePromptContext, type GenerateRecipeRequest, type PantryForPrompt } from "@/lib/domain/recipes";
import { getLlmClient, getLlmModel } from "@/lib/llm/client";
import { parseAndValidateRecipesJson, type RecipeCandidate } from "@/lib/llm/schema";

const SYSTEM_PROMPT = [
  "You are a recipe generator.",
  "Return only valid JSON matching this exact schema:",
  '{"recipes":[{"title":"string","ingredients":["string"],"steps":["string"],"notes":"string"}]}',
  "Do not include markdown, code fences, or extra keys.",
  "Generate exactly 3 recipes."
].join("\n");

export type GenerateRecipesSuccess = {
  ok: true;
  recipes: RecipeCandidate[];
  raw: string;
};

export type GenerateRecipesFailure = {
  ok: false;
  error: {
    code: "LLM_PARSE_ERROR" | "LLM_EMPTY_RESPONSE" | "LLM_REQUEST_FAILED";
    message: string;
  };
  raw: string;
};

export type GenerateRecipesResult = GenerateRecipesSuccess | GenerateRecipesFailure;

function getContentText(content: unknown): string {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "object" && item && "text" in item) {
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

async function requestRawRecipes(
  client: OpenAI,
  prompt: string
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: getLlmModel(),
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ]
  });

  return getContentText(completion.choices[0]?.message?.content);
}

export async function generateRecipesWithClient(
  client: OpenAI,
  pantryItems: PantryForPrompt[],
  constraints: GenerateRecipeRequest
): Promise<GenerateRecipesResult> {
  const promptContext = buildRecipePromptContext(pantryItems, constraints);

  let raw = "";

  try {
    raw = await requestRawRecipes(client, promptContext);

    if (!raw) {
      return {
        ok: false,
        error: { code: "LLM_EMPTY_RESPONSE", message: "Model returned an empty response." },
        raw
      };
    }

    try {
      const parsed = parseAndValidateRecipesJson(raw);
      return { ok: true, recipes: parsed.recipes, raw };
    } catch {
      const fixPrompt = [
        "Fix this JSON so it is valid and matches the schema exactly.",
        "Return only corrected JSON.",
        raw
      ].join("\n\n");

      const fixedRaw = await requestRawRecipes(client, fixPrompt);
      raw = fixedRaw || raw;

      try {
        const parsedFixed = parseAndValidateRecipesJson(raw);
        return { ok: true, recipes: parsedFixed.recipes, raw };
      } catch {
        console.error("LLM parse failure after retry", { raw });
        return {
          ok: false,
          error: {
            code: "LLM_PARSE_ERROR",
            message: "Model output was not valid JSON after retry."
          },
          raw
        };
      }
    }
  } catch (error) {
    console.error("LLM request failed", error);
    return {
      ok: false,
      error: { code: "LLM_REQUEST_FAILED", message: "Failed to call LLM provider." },
      raw
    };
  }
}

export async function generateRecipes(
  pantryItems: PantryForPrompt[],
  constraints: GenerateRecipeRequest
): Promise<GenerateRecipesResult> {
  const client = getLlmClient();
  return generateRecipesWithClient(client, pantryItems, constraints);
}
