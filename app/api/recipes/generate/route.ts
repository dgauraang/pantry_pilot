import { NextResponse } from "next/server";
import { listPantryItems } from "@/lib/db/pantry";
import { generateRecipeRequestSchema } from "@/lib/domain/recipes";
import { getLlmApiKey, getLlmBaseUrl, getLlmModel, smokeCheckLlmAuth } from "@/lib/llm/client";
import { generateRecipes } from "@/lib/llm/generateRecipes";

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = generateRecipeRequestSchema.safeParse({
    maxTime: json.maxTime ? Number(json.maxTime) : undefined,
    cuisine: json.cuisine,
    dietaryNotes: json.dietaryNotes
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const apiKey = getLlmApiKey();
  const baseURL = getLlmBaseUrl();
  const model = getLlmModel();
  console.log("[LLM Config]", {
    baseURL,
    model,
    tokenPrefix: apiKey.slice(0, 3),
    tokenLength: apiKey.length
  });

  if (process.env.LLM_SMOKE_CHECK === "true") {
    const smokeStatus = await smokeCheckLlmAuth();
    console.log("[LLM SmokeCheck]", { url: `${baseURL}/models`, status: smokeStatus });
  }

  const pantryItems = await listPantryItems();
  const result = await generateRecipes(pantryItems, parsed.data);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ recipes: result.recipes });
}
