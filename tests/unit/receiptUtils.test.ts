import { describe, expect, it } from "vitest";
import type { PantryItem } from "@prisma/client";
import { decideMergeForLine } from "@/lib/receipts/merge";
import { normalizeName, normalizeUnit } from "@/lib/receipts/normalize";
import { parseReceiptLine, parseReceiptText } from "@/lib/receipts/parseLineItems";
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

describe("parseReceiptLine", () => {
  it("filters obvious non-ingredient receipt text", () => {
    const noisyLines = [
      "Give us feedback @ sur",
      "Thank you! In :VROPS ogg \"Cm",
      "Walmart › ‹",
      "__. WM Supercenter",
      "972-731-. JAYNE",
      "AR OHIO DR",
      "STINT 0 TX 75024",
      "ITEMS SOLD",
      "11/02/2026 14:33:22",
      "1234 MAIN ST"
    ];

    for (const line of noisyLines) {
      expect(parseReceiptLine(line)).toBeNull();
    }
  });

  it("keeps item rows from mixed OCR text", () => {
    const parsed = parseReceiptText(["Walmart Supercenter", "Bananas 2 lb", "Subtotal 12.99", "Thank you"].join("\n"));

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.normalizedName).toBe("banana");
    expect(parsed[0]?.quantityValue).toBe(2);
    expect(parsed[0]?.unit).toBe("lb");
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

  it("skips ignored rows even when confidence is high", () => {
    const decision = decideMergeForLine(
      {
        name: "Tomatoes",
        quantityValue: 2,
        unit: "kg",
        confidence: 0.95,
        confirmed: true,
        ignored: true
      },
      [pantryItem({})],
      0.7
    );

    expect(decision.action).toBe("skip");
  });
});
