import { describe, expect, it } from "vitest";
import type { PantryItem } from "@prisma/client";
import { decideMergeForLine } from "@/lib/receipts/merge";
import { normalizeName, normalizeUnit } from "@/lib/receipts/normalize";
import { parseQuantity } from "@/lib/receipts/quantity";

describe("normalizeName", () => {
  it("lowercases, trims, and singularizes basic plurals", () => {
    expect(normalizeName("  Tomatoes  ")).toBe("tomato");
    expect(normalizeName("Green Apples")).toBe("green apple");
  });
});

describe("normalizeUnit", () => {
  it("maps aliases to canonical units", () => {
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit("Tablespoons")).toBe("tbsp");
  });
});

describe("parseQuantity", () => {
  it("parses multipack format", () => {
    const parsed = parseQuantity("2 x 400g");
    expect(parsed.quantityValue).toBe(800);
    expect(parsed.unit).toBe("g");
  });

  it("parses decimal quantity with unit", () => {
    const parsed = parseQuantity("1.5 lb");
    expect(parsed.quantityValue).toBe(1.5);
    expect(parsed.unit).toBe("lb");
  });

  it("parses compact number+unit", () => {
    const parsed = parseQuantity("12oz");
    expect(parsed.quantityValue).toBe(12);
    expect(parsed.unit).toBe("oz");
  });
});

function pantryItem(overrides: Partial<PantryItem>): PantryItem {
  return {
    id: "pantry-1",
    name: "Tomato",
    normalizedName: "tomato",
    quantity: "2 kg",
    quantityValue: 2,
    unit: "kg",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe("decideMergeForLine", () => {
  it("updates existing item when names and units are compatible", () => {
    const decision = decideMergeForLine(
      {
        name: "Tomatoes",
        quantityValue: 1,
        unit: "kg",
        confidence: 0.95,
        confirmed: true
      },
      [pantryItem({})],
      0.7
    );

    expect(decision.action).toBe("update");
    if (decision.action === "update") {
      expect(decision.data.quantityValue).toBe(3);
      expect(decision.data.unit).toBe("kg");
    }
  });

  it("creates a new item when unit is incompatible", () => {
    const decision = decideMergeForLine(
      {
        name: "Tomatoes",
        quantityValue: 4,
        unit: "pc",
        confidence: 0.95,
        confirmed: true
      },
      [pantryItem({})],
      0.7
    );

    expect(decision.action).toBe("create");
  });

  it("skips unconfirmed low confidence rows", () => {
    const decision = decideMergeForLine(
      {
        name: "Unclear Item",
        quantityValue: null,
        unit: null,
        confidence: 0.4,
        confirmed: false
      },
      [],
      0.7
    );

    expect(decision.action).toBe("skip");
  });
});
