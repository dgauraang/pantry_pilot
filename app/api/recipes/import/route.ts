import { NextResponse } from "next/server";
import { z } from "zod";
import { createChatCompletionWithFallback, getLlmClient } from "@/lib/llm/client";
import { recipeSchema, tryParseRecipesFromFreeform } from "@/lib/llm/schema";

const importRecipeSchema = z.object({
  url: z.string().trim().url()
});

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const LLM_IMPORT_MAX_ATTEMPTS = 2;

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Recipe import failed";
  }

  const topLevelMessage =
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";

  const apiError = (error as { error?: unknown }).error;
  if (apiError && typeof apiError === "object") {
    const message =
      typeof (apiError as { message?: unknown }).message === "string"
        ? (apiError as { message: string }).message
        : "";
    const raw =
      typeof (apiError as { metadata?: { raw?: unknown } }).metadata?.raw === "string"
        ? (apiError as { metadata: { raw: string } }).metadata.raw
        : "";
    return raw || message || topLevelMessage || "Recipe import failed";
  }

  return topLevelMessage || "Recipe import failed";
}

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower) || lower.endsWith(".local")) {
    return true;
  }

  if (/^10\./.test(lower) || /^192\.168\./.test(lower)) {
    return true;
  }

  const match172 = lower.match(/^172\.(\d+)\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
}

function sanitizeHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) {
    return "";
  }

  return match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function ensureArrayOfStrings(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizeInstructions(input: unknown): string[] {
  if (!Array.isArray(input)) {
    if (typeof input === "string" && input.trim()) {
      return [input.trim()];
    }
    return [];
  }

  const steps: string[] = [];
  for (const step of input) {
    if (typeof step === "string" && step.trim()) {
      steps.push(step.trim());
      continue;
    }

    if (typeof step === "object" && step && "text" in step) {
      const text = (step as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        steps.push(text.trim());
      }
    }
  }

  return steps;
}

function hasRecipeType(input: unknown): boolean {
  if (!input) {
    return false;
  }

  if (typeof input === "string") {
    return input.toLowerCase() === "recipe";
  }

  if (Array.isArray(input)) {
    return input.some((item) => typeof item === "string" && item.toLowerCase() === "recipe");
  }

  return false;
}

function findRecipeNode(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findRecipeNode(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const node = input as Record<string, unknown>;
  if (hasRecipeType(node["@type"])) {
    return node;
  }

  const graph = node["@graph"];
  if (Array.isArray(graph)) {
    const fromGraph = findRecipeNode(graph);
    if (fromGraph) {
      return fromGraph;
    }
  }

  return null;
}

function extractRecipeFromJsonLd(html: string): z.infer<typeof recipeSchema> | null {
  const scriptMatches = [...html.matchAll(/<script[^>]*type=\"application\/ld\+json\"[^>]*>([\s\S]*?)<\/script>/gi)];

  for (const match of scriptMatches) {
    const content = (match[1] || "").trim();
    if (!content) {
      continue;
    }

    try {
      const parsed = JSON.parse(content) as unknown;
      const recipeNode = findRecipeNode(parsed);
      if (!recipeNode) {
        continue;
      }

      const title = typeof recipeNode.name === "string" ? recipeNode.name.trim() : "";
      const ingredients = ensureArrayOfStrings(recipeNode.recipeIngredient);
      const steps = normalizeInstructions(recipeNode.recipeInstructions);
      const notes =
        typeof recipeNode.description === "string" ? recipeNode.description.trim() : "";

      if (!title || ingredients.length === 0 || steps.length === 0) {
        continue;
      }

      return recipeSchema.parse({ title, ingredients, steps, notes });
    } catch {
      continue;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = importRecipeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const url = new URL(parsed.data.url);
  if (!["http:", "https:"].includes(url.protocol) || isPrivateHostname(url.hostname)) {
    return NextResponse.json({ error: "URL is not allowed" }, { status: 400 });
  }

  let html = "";
  try {
    const pageResponse = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 PantryPilot/1.0",
        "Accept-Language": "en-US,en;q=0.9"
      },
      cache: "no-store"
    });

    if (!pageResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch recipe page" }, { status: 502 });
    }

    const contentType = pageResponse.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ error: "Recipe URL must return an HTML page" }, { status: 400 });
    }

    html = await pageResponse.text();
  } catch (error) {
    console.error("Failed to download recipe page", error);
    return NextResponse.json({ error: "Failed to fetch recipe page" }, { status: 502 });
  }

  const pageTitle = extractTitle(html);
  const jsonLdRecipe = extractRecipeFromJsonLd(html);
  if (jsonLdRecipe) {
    return NextResponse.json({
      recipe: jsonLdRecipe,
      source: {
        url: url.toString(),
        title: pageTitle,
        extraction: "json-ld"
      }
    });
  }

  const pageText = sanitizeHtmlToText(html).slice(0, 18000);

  const client = getLlmClient();
  const systemPrompt = [
    "You extract one cooking recipe from webpage text.",
    "Return only JSON.",
    'Schema: {"title":"string","ingredients":["string"],"steps":["string"],"notes":"string"}',
    "No markdown, no code fences, no extra keys."
  ].join("\n");

  const userPrompt = [
    `Source URL: ${url.toString()}`,
    `Page title: ${pageTitle || "(missing)"}`,
    "Extract a single clear recipe from this page content:",
    pageText || "(empty page text)"
  ].join("\n\n");

  try {
    const { completion } = await createChatCompletionWithFallback(
      client,
      {
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      },
      { maxAttemptsPerModel: LLM_IMPORT_MAX_ATTEMPTS }
    );

    const content = completion.choices[0]?.message?.content;
    const raw = typeof content === "string" ? content : "";

    let recipe: z.infer<typeof recipeSchema> | null = null;

    try {
      recipe = recipeSchema.parse(JSON.parse(extractJsonBlock(raw)));
    } catch {
      const fallback = tryParseRecipesFromFreeform(raw);
      recipe = fallback?.recipes?.[0] ? recipeSchema.parse(fallback.recipes[0]) : null;
    }

    if (!recipe) {
      return NextResponse.json({ error: "Could not parse recipe from the page" }, { status: 502 });
    }

    return NextResponse.json({
      recipe,
      source: {
        url: url.toString(),
        title: pageTitle
      }
    });
  } catch (error) {
    console.error("Recipe import failed", error);
    const status = getErrorStatus(error);
    const message = getErrorMessage(error);
    const responseStatus = status === 429 ? 429 : 502;
    return NextResponse.json({ error: message }, { status: responseStatus });
  }
}
