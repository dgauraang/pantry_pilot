import { NextResponse } from "next/server";
import { z } from "zod";
import { applyReceiptItems } from "@/lib/db/receipts";
import { normalizeName, normalizeUnit } from "@/lib/receipts/normalize";

const applyReceiptSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        quantityValue: z.number().positive().nullable().optional(),
        unit: z.string().trim().nullable().optional(),
        rawLine: z.string().trim().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
        confirmed: z.boolean().optional()
      })
    )
    .min(1)
});

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const body = await request.json();
  const parsed = applyReceiptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await applyReceiptItems(
      context.params.id,
      parsed.data.items.map((item) => ({
        name: item.name,
        normalizedName: normalizeName(item.name),
        quantityValue: item.quantityValue ?? null,
        unit: normalizeUnit(item.unit),
        rawLine: item.rawLine ?? item.name,
        confidence: item.confidence ?? null,
        confirmed: item.confirmed ?? false
      }))
    );

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof Error && error.message === "RECEIPT_NOT_FOUND") {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    console.error("Failed to apply receipt", error);
    return NextResponse.json({ error: "Failed to apply receipt" }, { status: 500 });
  }
}
