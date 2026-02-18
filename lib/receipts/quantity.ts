import { normalizeUnit } from "@/lib/receipts/normalize";

export type ParsedQuantity = {
  quantityValue: number | null;
  unit: string | null;
  confidence: number;
  matchedText: string;
};

function toNumber(raw: string): number {
  return Number.parseFloat(raw);
}

function validNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function parseQuantity(input: string): ParsedQuantity {
  const text = input.trim().toLowerCase();
  if (!text) {
    return { quantityValue: null, unit: null, confidence: 0, matchedText: "" };
  }

  const multiMatch = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/i);
  if (multiMatch) {
    const multiplier = toNumber(multiMatch[1]);
    const base = toNumber(multiMatch[2]);
    const normalizedUnit = normalizeUnit(multiMatch[3]);

    if (validNumber(multiplier) && validNumber(base)) {
      return {
        quantityValue: Number((multiplier * base).toFixed(3)),
        unit: normalizedUnit,
        confidence: normalizedUnit ? 0.95 : 0.75,
        matchedText: multiMatch[0]
      };
    }
  }

  const quantityWithUnitMatch = text.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
  if (quantityWithUnitMatch) {
    const quantityValue = toNumber(quantityWithUnitMatch[1]);
    if (validNumber(quantityValue)) {
      const normalizedUnit = normalizeUnit(quantityWithUnitMatch[2]);
      return {
        quantityValue,
        unit: normalizedUnit,
        confidence: normalizedUnit ? 0.9 : 0.65,
        matchedText: quantityWithUnitMatch[0]
      };
    }
  }

  const quantityOnlyMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
  if (quantityOnlyMatch) {
    const quantityValue = toNumber(quantityOnlyMatch[1]);
    if (validNumber(quantityValue)) {
      return {
        quantityValue,
        unit: null,
        confidence: 0.65,
        matchedText: quantityOnlyMatch[0]
      };
    }
  }

  return { quantityValue: null, unit: null, confidence: 0.2, matchedText: "" };
}

export function parseQuantityFromFields(
  quantity?: string | null,
  unit?: string | null
): { quantityValue: number | null; unit: string | null } {
  const unitNormalized = normalizeUnit(unit);
  if (!quantity?.trim()) {
    return { quantityValue: null, unit: unitNormalized };
  }

  const combined = `${quantity} ${unit || ""}`.trim();
  const parsed = parseQuantity(combined);
  if (parsed.quantityValue === null) {
    return { quantityValue: null, unit: unitNormalized };
  }

  return {
    quantityValue: parsed.quantityValue,
    unit: parsed.unit ?? unitNormalized
  };
}
