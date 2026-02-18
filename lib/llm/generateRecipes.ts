import type OpenAI from "openai";
import { buildRecipePromptContext, type GenerateRecipeRequest, type PantryForPrompt } from "@/lib/domain/recipes";
import { createChatCompletionWithFallback, getLlmClient } from "@/lib/llm/client";
import { parseAndValidateRecipesJson, tryParseRecipesFromFreeform, type RecipeCandidate } from "@/lib/llm/schema";

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

function getProviderErrorMessage(error: unknown): string {
  const fallback = "Failed to call LLM provider.";

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const status = "status" in error && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : undefined;
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";

  if (status === 401) {
    return "LLM authentication failed (401). Check LLM_API_KEY and provider token permissions.";
  }

  if (status === 403) {
    return "LLM access denied (403). Verify token scope and model access.";
  }

  if (status === 404) {
    return "LLM model/provider endpoint not found (404). Check LLM_MODEL and LLM_BASE_URL.";
  }

  if (status) {
    return `LLM provider request failed (${status})${message ? `: ${message}` : "."}`;
  }

  return message || fallback;
}

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
  const { completion } = await createChatCompletionWithFallback(client, {
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
        const salvaged = tryParseRecipesFromFreeform(raw);
        if (salvaged) {
          console.warn("LLM returned freeform output; salvaged recipes from text blocks.");
          return { ok: true, recipes: salvaged.recipes, raw };
        }

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
      error: { code: "LLM_REQUEST_FAILED", message: getProviderErrorMessage(error) },
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
