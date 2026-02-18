import type { PantryItem, Receipt, ReceiptLineItem } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/receipts/parseLineItems";
import { decideMergeForLine, type ApplyLineItem } from "@/lib/receipts/merge";

export type CreateReceiptInput = {
  filePath: string;
  mimeType: string;
  originalName: string;
  ocrText: string;
  ocrConfidence: number | null;
  items: Array<{
    name: string;
    normalizedName: string;
    quantityValue: number | null;
    unit: string | null;
    rawLine: string;
    confidence: number;
    confirmed?: boolean;
  }>;
};

export type ReceiptWithItems = Receipt & {
  lineItems: ReceiptLineItem[];
};

export async function createReceiptWithItems(input: CreateReceiptInput): Promise<ReceiptWithItems> {
  return prisma.receipt.create({
    data: {
      filePath: input.filePath,
      mimeType: input.mimeType,
      originalName: input.originalName,
      ocrText: input.ocrText,
      ocrConfidence: input.ocrConfidence,
      lineItems: {
        create: input.items.map((item) => ({
          name: item.name,
          normalizedName: item.normalizedName,
          quantityValue: item.quantityValue,
          unit: item.unit,
          rawLine: item.rawLine,
          confidence: item.confidence,
          confirmed: item.confirmed ?? false
        }))
      }
    },
    include: { lineItems: true }
  });
}

export async function getReceiptWithItems(id: string): Promise<ReceiptWithItems | null> {
  return prisma.receipt.findUnique({ where: { id }, include: { lineItems: true } });
}

export type ApplyReceiptResult = {
  created: number;
  updated: number;
  skipped: number;
};

export async function applyReceiptItems(
  receiptId: string,
  editedItems: ApplyLineItem[]
): Promise<ApplyReceiptResult> {
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findUnique({ where: { id: receiptId } });
    if (!receipt) {
      throw new Error("RECEIPT_NOT_FOUND");
    }

    const existingItems = await tx.pantryItem.findMany({ orderBy: { createdAt: "asc" } });
    const workingItems: PantryItem[] = [...existingItems];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of editedItems) {
      const decision = decideMergeForLine(item, workingItems, LOW_CONFIDENCE_THRESHOLD);

      if (decision.action === "skip") {
        skipped += 1;
        continue;
      }

      if (decision.action === "update") {
        const row = await tx.pantryItem.update({
          where: { id: decision.pantryItemId },
          data: decision.data
        });

        const index = workingItems.findIndex((candidate) => candidate.id === row.id);
        if (index >= 0) {
          workingItems[index] = row;
        }

        updated += 1;
        continue;
      }

      const row = await tx.pantryItem.create({ data: decision.data });
      workingItems.push(row);
      created += 1;
    }

    await tx.receiptLineItem.deleteMany({ where: { receiptId } });
    if (editedItems.length > 0) {
      await tx.receiptLineItem.createMany({
        data: editedItems.map((item) => ({
          receiptId,
          name: item.name,
          normalizedName: item.normalizedName ?? item.name.toLowerCase().trim(),
          quantityValue: item.quantityValue ?? null,
          unit: item.unit ?? null,
          rawLine: item.rawLine ?? item.name,
          confidence: item.confidence ?? null,
          confirmed: item.confirmed ?? false
        }))
      });
    }

    await tx.receipt.update({
      where: { id: receiptId },
      data: {
        status: "applied",
        appliedAt: new Date()
      }
    });

    return { created, updated, skipped };
  });
}
