import { describe, expect, it, vi } from "vitest";
import { parseAndValidateRecipesJson, tryParseRecipesFromFreeform } from "@/lib/llm/schema";
import { generateRecipesWithClient } from "@/lib/llm/generateRecipes";

function createMockClient(responses: string[]) {
  const create = vi.fn(async () => {
    const content = responses.shift() ?? "";
    return {
      choices: [{ message: { content } }]
    };
  });

  return {
    chat: {
      completions: {
        create
      }
    }
  } as any;
}

describe("parseAndValidateRecipesJson", () => {
  it("accepts valid json", () => {
    const parsed = parseAndValidateRecipesJson(
      JSON.stringify({
        recipes: [
          {
            title: "Rice Bowl",
            ingredients: ["Rice", "Tomato"],
            steps: ["Cook rice", "Mix tomato"],
            notes: "Quick meal"
          }
        ]
      })
    );

    expect(parsed.recipes[0].title).toBe("Rice Bowl");
  });

  it("throws on malformed json", () => {
    expect(() => parseAndValidateRecipesJson('{"recipes": [}')).toThrow();
  });
});

describe("tryParseRecipesFromFreeform", () => {
  it("extracts recipes from non-JSON recipe blocks", () => {
    const raw = [
      "<think>internal reasoning</think>",
      "Recipe 1: Chickpea Tomato Rice",
      "Ingredients:",
      "- 1 cup rice",
      "- 1 can chickpeas",
      "Steps:",
      "1. Cook rice",
      "2. Add chickpeas",
      "Notes: Quick and easy",
      "",
      "Recipe 2: Tomato Onion Rice",
      "Ingredients:",
      "- 1 cup rice",
      "- 2 tomatoes",
      "Steps:",
      "1. Saute onion",
      "2. Mix with rice",
      "Notes: Mild spice"
    ].join("\n");

    const parsed = tryParseRecipesFromFreeform(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.recipes.length).toBe(2);
    expect(parsed?.recipes[0].title).toBe("Chickpea Tomato Rice");
  });
});

describe("generateRecipesWithClient", () => {
  it("retries once when first output is malformed", async () => {
    const client = createMockClient([
      '{"recipes":[{"title":"Bad","ingredients":["a"],"steps":["b"]',
      JSON.stringify({
        recipes: [
          {
            title: "Recovered Recipe",
            ingredients: ["Item A"],
            steps: ["Step A"],
            notes: "Recovered"
          }
        ]
      })
    ]);

    const result = await generateRecipesWithClient(client, [{ name: "Rice" }], {
      maxTime: 20,
      cuisine: "Any",
      dietaryNotes: "None"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recipes[0].title).toBe("Recovered Recipe");
    }
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("salvages freeform response when retry is still non-JSON", async () => {
    const client = createMockClient([
      "Not JSON",
      [
        "Recipe 1: Pantry Rice Bowl",
        "Ingredients:",
        "- Rice",
        "- Onion",
        "Steps:",
        "1. Cook rice",
        "2. Saute onion",
        "Notes: Uses pantry staples"
      ].join("\n")
    ]);

    const result = await generateRecipesWithClient(client, [{ name: "Rice" }], {
      maxTime: 20,
      cuisine: "Any",
      dietaryNotes: "None"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recipes[0].title).toBe("Pantry Rice Bowl");
    }
  });
});
