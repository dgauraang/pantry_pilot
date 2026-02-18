"use client";

import { FormEvent, useState } from "react";

type RecipeCandidate = {
  title: string;
  ingredients: string[];
  steps: string[];
  notes: string;
};

export default function GeneratePage() {
  const [maxTime, setMaxTime] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [recipes, setRecipes] = useState<RecipeCandidate[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    setRecipes([]);

    const response = await fetch("/api/recipes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maxTime: maxTime ? Number(maxTime) : undefined,
        cuisine,
        dietaryNotes
      })
    });

    const payload = (await response.json()) as {
      recipes?: RecipeCandidate[];
      error?: { message?: string };
    };

    if (!response.ok || !payload.recipes) {
      setError(payload.error?.message ?? "Recipe generation failed.");
      setLoading(false);
      return;
    }

    setRecipes(payload.recipes);
    setLoading(false);
  }

  async function saveRecipe(recipe: RecipeCandidate) {
    await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...recipe,
        promptJson: JSON.stringify({ maxTime, cuisine, dietaryNotes })
      })
    });
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Generate Recipes</h1>
      <form className="grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-4" onSubmit={handleSubmit}>
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          min={1}
          onChange={(event) => setMaxTime(event.target.value)}
          placeholder="Max time (minutes)"
          type="number"
          value={maxTime}
        />
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) => setCuisine(event.target.value)}
          placeholder="Cuisine"
          value={cuisine}
        />
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) => setDietaryNotes(event.target.value)}
          placeholder="Dietary notes"
          value={dietaryNotes}
        />
        <button className="rounded-md bg-brand-500 px-4 py-2 font-medium text-white" type="submit">
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>

      {error ? <p className="rounded-md bg-red-100 p-3 text-red-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {recipes.map((recipe) => (
          <article className="space-y-2 rounded-xl bg-white p-4 shadow-sm" key={recipe.title}>
            <h2 className="text-lg font-semibold">{recipe.title}</h2>
            <p className="text-sm text-slate-700">{recipe.notes}</p>
            <div>
              <h3 className="font-medium">Ingredients</h3>
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {recipe.ingredients.map((ingredient) => (
                  <li key={ingredient}>{ingredient}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium">Steps</h3>
              <ol className="list-decimal pl-5 text-sm text-slate-700">
                {recipe.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <button
              className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white"
              onClick={() => saveRecipe(recipe)}
              type="button"
            >
              Save
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
