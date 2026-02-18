import { expect, test } from "@playwright/test";

test("seed pantry, generate recipes with mock, and save", async ({ page }) => {
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Seed Sample Pantry" }).click();

  await page.goto("/generate");

  await page.route("**/api/recipes/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        recipes: [
          {
            title: "Mock Lentil Soup",
            ingredients: ["Lentils", "Onion"],
            steps: ["Boil", "Season"],
            notes: "Mocked"
          },
          {
            title: "Mock Rice Bowl",
            ingredients: ["Rice", "Tomato"],
            steps: ["Cook", "Top"],
            notes: "Mocked"
          },
          {
            title: "Mock Chickpea Salad",
            ingredients: ["Chickpeas", "Olive oil"],
            steps: ["Mix", "Serve"],
            notes: "Mocked"
          }
        ]
      })
    });
  });

  await page.getByPlaceholder("Max time (minutes)").fill("30");
  await page.getByPlaceholder("Cuisine").fill("Mediterranean");
  await page.getByPlaceholder("Dietary notes").fill("Vegetarian");
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.getByText("Mock Lentil Soup")).toBeVisible();
  await expect(page.getByText("Mock Rice Bowl")).toBeVisible();
  await expect(page.getByText("Mock Chickpea Salad")).toBeVisible();

  await page.getByRole("button", { name: "Save" }).first().click();

  await page.goto("/recipes");
  await expect(page.getByRole("link", { name: "Mock Lentil Soup" })).toBeVisible();
});
