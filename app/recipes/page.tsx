"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecipeView = {
  id: string;
  title: string;
  createdAt: string;
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecipes() {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/recipes", { cache: "no-store" });
      const payload = (await response.json()) as {
        recipes?: RecipeView[];
        error?: string;
      };

      if (!response.ok || !payload.recipes) {
        setError(payload.error || "Failed to load recipes.");
        return;
      }

      setRecipes(payload.recipes);
    } catch {
      setError("Failed to load recipes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecipes();
  }, []);

  async function deleteRecipe(id: string) {
    const response = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Failed to delete recipe.");
      return;
    }

    setRecipes((current) => current.filter((recipe) => recipe.id !== id));
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Saved Recipes</h1>

      {loading ? <p className="text-sm text-slate-600">Loading recipes...</p> : null}
      {error ? <p className="rounded-md bg-red-100 p-3 text-red-700">{error}</p> : null}

      <ul className="space-y-2">
        {recipes.map((recipe) => (
          <li className="flex items-center justify-between gap-3 rounded-lg bg-white p-4 shadow-sm" key={recipe.id}>
            <div>
              <Link className="font-medium text-brand-700" href={`/recipes/${recipe.id}`}>
                {recipe.title}
              </Link>
              <p className="text-sm text-slate-600">{new Date(recipe.createdAt).toLocaleString()}</p>
            </div>
            <button
              className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700"
              onClick={() => deleteRecipe(recipe.id)}
              type="button"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {!loading && recipes.length === 0 ? <p className="text-sm text-slate-600">No saved recipes yet.</p> : null}
    </section>
  );
}
