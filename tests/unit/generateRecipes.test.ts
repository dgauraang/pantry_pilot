import { describe, expect, it, vi } from "vitest";
import { parseAndValidateRecipesJson } from "@/lib/llm/schema";
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
});
