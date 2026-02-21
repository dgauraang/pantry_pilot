import type { PantryItem } from "@prisma/client";
import { areUnitsCompatible, normalizeName, normalizeUnit } from "@/lib/receipts/normalize";

export type ApplyLineItem = {
  name: string;
  normalizedName?: string;
  quantityValue?: number | null;
  unit?: string | null;
  rawLine?: string;
  confidence?: number | null;
  confirmed?: boolean;
  ignored?: boolean;
};

export type MergeDecision =
  | {
      action: "update";
      pantryItemId: string;
      data: {
        name: string;
        normalizedName: string;
        quantityValue: number | null;
        quantity: string | null;
        unit: string | null;
      };
    }
  | {
      action: "create";
      data: {
        name: string;
        normalizedName: string;
        quantityValue: number | null;
        quantity: string | null;
        unit: string | null;
      };
    }
  | {
      action: "skip";
      reason: "ignored" | "unconfirmed" | "missing_name";
    };

export function toQuantityString(quantityValue?: number | null): string | null {
  if (quantityValue === null || quantityValue === undefined || !Number.isFinite(quantityValue)) {
    return null;
  }

  return Number(quantityValue.toFixed(3)).toString();
}

export function decideMergeForLine(
  line: ApplyLineItem,
  existingItems: PantryItem[],
  lowConfidenceThreshold: number
): MergeDecision {
  const normalizedName = line.normalizedName || normalizeName(line.name);
  if (!normalizedName) {
    return { action: "skip", reason: "missing_name" };
  }

  if (line.ignored) {
    return { action: "skip", reason: "ignored" };
  }

  if (line.confirmed === false && (line.confidence ?? 0) < lowConfidenceThreshold) {
    return { action: "skip", reason: "unconfirmed" };
  }

  const normalizedUnit = normalizeUnit(line.unit);
  const quantityValue =
    line.quantityValue !== undefined && line.quantityValue !== null && Number.isFinite(line.quantityValue)
      ? Number(line.quantityValue)
      : null;

  const sameNameCandidates = existingItems.filter((item) => item.normalizedName === normalizedName);
  const compatible = sameNameCandidates.find((item) => areUnitsCompatible(item.unit, normalizedUnit));

  if (compatible) {
    const nextQuantityValue =
      quantityValue !== null && compatible.quantityValue !== null
        ? Number((compatible.quantityValue + quantityValue).toFixed(3))
        : compatible.quantityValue ?? quantityValue;

    return {
      action: "update",
      pantryItemId: compatible.id,
      data: {
        name: compatible.name,
        normalizedName,
        quantityValue: nextQuantityValue,
        quantity: toQuantityString(nextQuantityValue),
        unit: normalizeUnit(compatible.unit) ?? normalizedUnit
      }
    };
  }

  return {
    action: "create",
    data: {
      name: line.name.trim() || normalizedName,
      normalizedName,
      quantityValue,
      quantity: toQuantityString(quantityValue),
      unit: normalizedUnit
    }
  };
}
