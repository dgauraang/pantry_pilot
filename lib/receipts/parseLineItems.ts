import { normalizeName, normalizeUnit } from "@/lib/receipts/normalize";
import { parseQuantity } from "@/lib/receipts/quantity";

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export type ParsedReceiptLineItem = {
  name: string;
  normalizedName: string;
  quantityValue: number | null;
  unit: string | null;
  rawLine: string;
  confidence: number;
  requiresConfirmation: boolean;
};

function cleanLine(rawLine: string): string {
  return rawLine
    .replace(/^[\s*#\-:]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNameFromLine(cleaned: string, matchedText: string): string {
  if (!matchedText) {
    return cleaned;
  }

  const escapedMatch = matchedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (new RegExp(`^${escapedMatch}\\b`, "i").test(cleaned)) {
    return cleaned.replace(new RegExp(`^${escapedMatch}\\s*`, "i"), "").trim();
  }

  if (new RegExp(`\\b${escapedMatch}$`, "i").test(cleaned)) {
    return cleaned.replace(new RegExp(`\\s*${escapedMatch}$`, "i"), "").trim();
  }

  return cleaned.replace(new RegExp(escapedMatch, "i"), "").replace(/\s+/g, " ").trim();
}

export function parseReceiptLine(rawLine: string): ParsedReceiptLineItem | null {
  const cleaned = cleanLine(rawLine);
  if (!cleaned || cleaned.length < 2) {
    return null;
  }

  const parsedQuantity = parseQuantity(cleaned);
  const candidateName = extractNameFromLine(cleaned, parsedQuantity.matchedText);
  const name = candidateName || cleaned;
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    return null;
  }

  const hasQuantity = parsedQuantity.quantityValue !== null;
  let confidence = Math.max(parsedQuantity.confidence, 0.5);
  if (name.length > 2) {
    confidence += 0.1;
  }
  if (hasQuantity && parsedQuantity.unit) {
    confidence += 0.05;
  }

  const boundedConfidence = Math.min(Number(confidence.toFixed(2)), 0.99);

  return {
    name,
    normalizedName,
    quantityValue: parsedQuantity.quantityValue,
    unit: normalizeUnit(parsedQuantity.unit),
    rawLine,
    confidence: boundedConfidence,
    requiresConfirmation: boundedConfidence < LOW_CONFIDENCE_THRESHOLD
  };
}

export function parseReceiptText(ocrText: string): ParsedReceiptLineItem[] {
  return ocrText
    .split(/\r?\n/)
    .map((line) => parseReceiptLine(line))
    .filter((line): line is ParsedReceiptLineItem => Boolean(line));
}
