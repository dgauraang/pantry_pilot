import { normalizeName, normalizeUnit } from "@/lib/receipts/normalize";
import { parseQuantity } from "@/lib/receipts/quantity";

export const LOW_CONFIDENCE_THRESHOLD = 0.7;
const RECEIPT_META_TERMS = [
  "visit us",
  "walmart",
  "supercenter",
  "total",
  "tax",
  "cashier",
  "register",
  "transaction",
  "approval",
  "return policy",
  "debit",
  "credit",
  "gift card",
  "store #"
];
const HIGH_SIGNAL_META_TERMS = [
  "thank you",
  "feedback",
  "survey",
  "items sold",
  "subtotal",
  "balance due",
  "change due"
];

const ZIP_REGEX = /\b\d{5}(?:-\d{4})?\b/;
const PHONE_REGEX = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const ADDRESS_REGEX =
  /^\d{1,5}\s+[a-z0-9.\s]+(?:\bst\b|\bstreet\b|\bave\b|\bavenue\b|\brd\b|\broad\b|\bdr\b|\bdrive\b|\bblvd\b|\bln\b|\blane\b|\bhwy\b)/i;
const STATE_ZIP_REGEX = /\b[a-z]{2}\s+\d{5}(?:-\d{4})?\b/i;
const TRAILING_PRICE_REGEX = /(?:^|\s)\d{1,3}(?:,\d{3})*(?:\.\d{2})\s*$/;
const DATE_TIME_REGEX = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b\d{1,2}:\d{2}(?::\d{2})?\b/;
const STREET_SUFFIX_REGEX = /\b(st|street|ave|avenue|rd|road|dr|drive|blvd|ln|lane|hwy|way)\b/i;

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

function scoreReceiptLine(
  cleaned: string,
  candidateName: string,
  parsedQuantity: ReturnType<typeof parseQuantity>
): { noiseScore: number; itemScore: number } {
  const lowered = cleaned.toLowerCase();
  const tokens = candidateName.split(/\s+/).filter(Boolean);
  const alphaCount = (candidateName.match(/[a-z]/gi) || []).length;
  const digitCount = (candidateName.match(/\d/g) || []).length;
  const symbolCount = (candidateName.match(/[^a-z0-9\s]/gi) || []).length;
  const charCount = Math.max(1, alphaCount + digitCount + symbolCount);
  const alphaRatio = alphaCount / charCount;
  const digitRatio = digitCount / charCount;
  const symbolRatio = symbolCount / charCount;
  const longTokenCount = tokens.filter((token) => token.length >= 3).length;
  const shortTokenCount = tokens.filter((token) => token.length <= 2).length;
  const hasKnownUnit = Boolean(parsedQuantity.unit);
  const hasQuantity = parsedQuantity.quantityValue !== null;
  const hasTrailingPrice = TRAILING_PRICE_REGEX.test(cleaned);
  const hasDateOrTime = DATE_TIME_REGEX.test(cleaned);
  const hasLongDigitRun = /\d{6,}/.test(cleaned.replace(/\s+/g, ""));
  const hasStreetSuffix = STREET_SUFFIX_REGEX.test(cleaned);
  const hasStateLikeToken = /\b[A-Z]{2}\b/.test(cleaned);
  const hasReceiptMetaTerm = RECEIPT_META_TERMS.some((term) => lowered.includes(term));
  const hasHighSignalMetaTerm = HIGH_SIGNAL_META_TERMS.some((term) => lowered.includes(term));

  let noiseScore = 0;
  let itemScore = 0;

  if (hasReceiptMetaTerm) {
    noiseScore += 0.45;
  }
  if (hasHighSignalMetaTerm) {
    noiseScore += 0.4;
  }

  if (PHONE_REGEX.test(cleaned) || ADDRESS_REGEX.test(cleaned) || STATE_ZIP_REGEX.test(cleaned)) {
    noiseScore += 0.7;
  }

  if (ZIP_REGEX.test(cleaned) && !hasKnownUnit) {
    noiseScore += 0.35;
  }

  if (hasDateOrTime) {
    noiseScore += 0.45;
  }

  if (hasLongDigitRun) {
    noiseScore += 0.35;
  }

  if (hasStreetSuffix && hasStateLikeToken && !hasKnownUnit) {
    noiseScore += 0.55;
  }

  if (digitRatio >= 0.45) {
    noiseScore += 0.3;
  }

  if (symbolRatio >= 0.22) {
    noiseScore += 0.2;
  }

  if (!hasKnownUnit && !hasTrailingPrice && longTokenCount <= 1 && shortTokenCount >= 1) {
    noiseScore += 0.2;
  }

  if (hasKnownUnit) {
    itemScore += 0.35;
  }
  if (hasQuantity) {
    itemScore += 0.2;
  }
  if (longTokenCount >= 1) {
    itemScore += 0.22;
  }
  if (tokens.length >= 1 && tokens.length <= 6) {
    itemScore += 0.08;
  }
  if (hasTrailingPrice) {
    itemScore += 0.14;
  }
  if (alphaRatio >= 0.55) {
    itemScore += 0.1;
  }
  if (digitRatio <= 0.35) {
    itemScore += 0.05;
  }

  return {
    noiseScore: Number(noiseScore.toFixed(3)),
    itemScore: Number(itemScore.toFixed(3))
  };
}

export function parseReceiptLine(rawLine: string): ParsedReceiptLineItem | null {
  const cleaned = cleanLine(rawLine);
  if (!cleaned || cleaned.length < 2) {
    return null;
  }

  const parsedQuantity = parseQuantity(cleaned);
  const candidateName = extractNameFromLine(cleaned, parsedQuantity.matchedText);
  const evaluatedName = candidateName || cleaned;
  const hasLetters = /[a-z]/i.test(evaluatedName);
  if (!hasLetters) {
    return null;
  }

  const { noiseScore, itemScore } = scoreReceiptLine(cleaned, evaluatedName, parsedQuantity);
  if (noiseScore >= 0.7 || noiseScore - itemScore >= 0.25) {
    return null;
  }

  const name = evaluatedName;
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    return null;
  }

  const hasQuantity = parsedQuantity.quantityValue !== null;
  let confidence = Math.max(parsedQuantity.confidence, 0.5) + itemScore * 0.12 - noiseScore * 0.1;
  if (name.length > 2) {
    confidence += 0.1;
  }
  if (hasQuantity && parsedQuantity.unit) {
    confidence += 0.05;
  }

  const boundedConfidence = Math.max(0.05, Math.min(Number(confidence.toFixed(2)), 0.99));

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
