import type { PantryItem } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeName, normalizeUnit } from "@/lib/receipts/normalize";
import { parseQuantityFromFields } from "@/lib/receipts/quantity";

export type PantryInput = {
  name: string;
  quantity?: string;
  unit?: string;
};

export async function listPantryItems(): Promise<PantryItem[]> {
  return prisma.pantryItem.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createPantryItem(input: PantryInput): Promise<PantryItem> {
  const normalizedName = normalizeName(input.name);
  const normalizedUnit = normalizeUnit(input.unit);
  const parsed = parseQuantityFromFields(input.quantity, normalizedUnit);

  return prisma.pantryItem.create({
    data: {
      name: input.name.trim(),
      normalizedName,
      quantity: input.quantity?.trim() || null,
      quantityValue: parsed.quantityValue,
      unit: parsed.unit
    }
  });
}

export async function deletePantryItem(id: string): Promise<void> {
  await prisma.pantryItem.delete({ where: { id } });
}

export async function seedPantryItems(): Promise<void> {
  const samples: PantryInput[] = [
    { name: "Rice", quantity: "2", unit: "cups" },
    { name: "Chickpeas", quantity: "1", unit: "can" },
    { name: "Tomatoes", quantity: "4" },
    { name: "Olive oil", quantity: "2", unit: "tbsp" },
    { name: "Onion", quantity: "1" }
  ];

  await prisma.$transaction([
    prisma.pantryItem.deleteMany(),
    prisma.pantryItem.createMany({
      data: samples.map((sample) => {
        const normalizedName = normalizeName(sample.name);
        const normalizedUnit = normalizeUnit(sample.unit);
        const parsed = parseQuantityFromFields(sample.quantity, normalizedUnit);
        return {
          ...sample,
          normalizedName,
          quantityValue: parsed.quantityValue,
          unit: parsed.unit
        };
      })
    })
  ]);
}
