import path from "node:path";
import { expect, test } from "@playwright/test";

test("upload receipt image, review rows, apply, and update pantry quantities", async ({ page }) => {
  type PantryItem = { id: string; name: string; quantity?: string | null; unit?: string | null };

  const pantryItems: PantryItem[] = [
    { id: "p-1", name: "Tomato", quantity: "1", unit: "kg" }
  ];

  await page.route("**/api/pantry", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: pantryItems })
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/receipts", async (route, request) => {
    if (request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          receipt: {
            id: "receipt-1",
            status: "pending",
            ocrConfidence: 0.91,
            rows: [
              {
                name: "Tomatoes",
                quantityValue: 1,
                unit: "kg",
                rawLine: "Tomatoes 1kg",
                confidence: 0.91,
                requiresConfirmation: false
              }
            ]
          }
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/receipts/receipt-1/apply", async (route, request) => {
    if (request.method() === "POST") {
      const body = request.postDataJSON() as {
        items: Array<{ name: string; quantityValue: number | null; unit?: string | null }>;
      };

      let created = 0;
      let updated = 0;
      for (const row of body.items) {
        const existing = pantryItems.find((item) => item.name.toLowerCase().startsWith("tomato") && item.unit === row.unit);
        if (existing && row.quantityValue) {
          const current = Number(existing.quantity?.split(" ")[0] || "0");
          existing.quantity = `${current + row.quantityValue}`;
          updated += 1;
        } else {
          pantryItems.push({
            id: `p-${pantryItems.length + 1}`,
            name: row.name,
            quantity: row.quantityValue ? `${row.quantityValue}` : null,
            unit: row.unit || null
          });
          created += 1;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { created, updated, skipped: 0 } })
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/pantry");
  await expect(page.getByText("Tomato")).toBeVisible();
  await expect(page.getByText("1 kg")).toBeVisible();

  const fixturePath = path.resolve("tests/fixtures/receipt-sample.png");
  await page.setInputFiles('input[type="file"]', fixturePath);
  await page.getByRole("button", { name: "Upload Receipt" }).click();

  await expect(page.getByText("Review Parsed Items")).toBeVisible();
  await expect(page.getByDisplayValue("Tomatoes")).toBeVisible();

  await page.getByRole("button", { name: "Apply to Pantry" }).click();
  await expect(page.getByText("Applied receipt: 0 created, 1 updated, 0 skipped.")).toBeVisible();
  await expect(page.getByText("2 kg")).toBeVisible();
});
