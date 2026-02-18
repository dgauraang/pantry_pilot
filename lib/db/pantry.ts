import type { PantryItem } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type PantryInput = {
  name: string;
  quantity?: string;
  unit?: string;
};

export async function listPantryItems(): Promise<PantryItem[]> {
  return prisma.pantryItem.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createPantryItem(input: PantryInput): Promise<PantryItem> {
  return prisma.pantryItem.create({ data: input });
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
    prisma.pantryItem.createMany({ data: samples })
  ]);
}
