-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PantryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "quantity" TEXT,
    "quantityValue" REAL,
    "unit" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PantryItem" ("createdAt", "id", "name", "normalizedName", "quantity", "quantityValue", "unit", "updatedAt")
SELECT "createdAt", "id", "name", lower(trim("name")), "quantity", NULL, "unit", "updatedAt" FROM "PantryItem";
DROP TABLE "PantryItem";
ALTER TABLE "new_PantryItem" RENAME TO "PantryItem";
CREATE INDEX "PantryItem_normalizedName_idx" ON "PantryItem"("normalizedName");

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "ocrText" TEXT NOT NULL,
    "ocrConfidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ReceiptLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "quantityValue" REAL,
    "unit" TEXT,
    "rawLine" TEXT NOT NULL,
    "confidence" REAL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReceiptLineItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReceiptLineItem_receiptId_idx" ON "ReceiptLineItem"("receiptId");
CREATE INDEX "ReceiptLineItem_normalizedName_idx" ON "ReceiptLineItem"("normalizedName");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
