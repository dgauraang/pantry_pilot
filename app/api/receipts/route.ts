import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createReceiptWithItems } from "@/lib/db/receipts";
import { hasLlmApiKey } from "@/lib/llm/client";
import { extractReceiptItemsWithLlm } from "@/lib/llm/receiptExtraction";
import { extractReceiptText } from "@/lib/ocr/receiptOcr";
import { LOW_CONFIDENCE_THRESHOLD, parseReceiptText } from "@/lib/receipts/parseLineItems";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;

const parsedRowSchema = z.object({
  name: z.string(),
  normalizedName: z.string(),
  quantityValue: z.number().positive().nullable(),
  unit: z.string().nullable(),
  rawLine: z.string(),
  confidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean()
});

function shouldUseLlmFallback(
  ocrConfidence: number,
  parsedRows: Array<{ confidence: number; quantityValue: number | null }>
) {
  if (ocrConfidence < 0.55 || parsedRows.length === 0) {
    return true;
  }

  if (parsedRows.length < 4) {
    return false;
  }

  const lowConfidenceCount = parsedRows.filter((row) => row.confidence < LOW_CONFIDENCE_THRESHOLD).length;
  const missingQuantityCount = parsedRows.filter((row) => row.quantityValue === null).length;

  return lowConfidenceCount / parsedRows.length >= 0.75 || missingQuantityCount / parsedRows.length >= 0.85;
}

function toJsonError(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData
    .getAll("file")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length !== 1) {
    return toJsonError("Provide exactly one receipt file in `file` field.", 400);
  }

  const file = files[0];
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return toJsonError("Only jpg/jpeg/png/webp images and PDF files are supported.", 400);
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return toJsonError(`File exceeds max size of ${MAX_UPLOAD_SIZE_BYTES} bytes.`, 400);
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "application/pdf"
          ? "pdf"
          : "jpg";
  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "data", "uploads", "receipts");
  const absolutePath = path.join(uploadDir, filename);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  const ocr = await extractReceiptText(absolutePath, file.type);
  if (file.type === "application/pdf" && ocr.errorCode === "pdf_tool_missing") {
    return toJsonError(
      "PDF processing tools are missing on server. Install poppler-utils (pdftotext/pdftoppm) and retry.",
      500
    );
  }

  let parsedRows = parseReceiptText(ocr.text);

  const needsLlmFallback = shouldUseLlmFallback(ocr.confidence, parsedRows);
  if (needsLlmFallback && hasLlmApiKey()) {
    try {
      const llmItems = await extractReceiptItemsWithLlm(ocr.text);
      parsedRows = llmItems.map((item) => ({
        name: item.name,
        normalizedName: item.normalizedName,
        quantityValue: item.quantityValue ?? null,
        unit: item.unit ?? null,
        rawLine: item.rawLine,
        confidence: item.confidence ?? 0.7,
        requiresConfirmation: (item.confidence ?? 0.7) < LOW_CONFIDENCE_THRESHOLD
      }));
    } catch (error) {
      console.error("LLM fallback failed", error);
    }
  }

  const rows = parsedRows.map((row) => ({
    ...row,
    quantityValue: row.quantityValue ?? null,
    unit: row.unit ?? null,
    requiresConfirmation: row.confidence < LOW_CONFIDENCE_THRESHOLD
  }));

  const validatedRowsParsed = z.array(parsedRowSchema).safeParse(rows);
  if (!validatedRowsParsed.success) {
    return NextResponse.json({ error: validatedRowsParsed.error.flatten() }, { status: 400 });
  }
  const validatedRows = validatedRowsParsed.data;
  const receipt = await createReceiptWithItems({
    filePath: absolutePath,
    mimeType: file.type,
    originalName: file.name,
    ocrText: ocr.text,
    ocrConfidence: ocr.confidence,
    items: validatedRows.map((row) => ({
      name: row.name,
      normalizedName: row.normalizedName,
      quantityValue: row.quantityValue,
      unit: row.unit,
      rawLine: row.rawLine,
      confidence: row.confidence,
      confirmed: !row.requiresConfirmation
    }))
  });

  return NextResponse.json(
    {
      receipt: {
        id: receipt.id,
        status: receipt.status,
        ocrConfidence: receipt.ocrConfidence,
        rows: validatedRows
      }
    },
    { status: 201 }
  );
}
