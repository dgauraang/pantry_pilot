"use client";

import { FormEvent, useEffect, useState } from "react";

type RecipeCandidate = {
  title: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  sourceUrl?: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const ACTION_COOLDOWN_MS = 10_000;

export default function GeneratePage() {
  const [maxTime, setMaxTime] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [recipes, setRecipes] = useState<RecipeCandidate[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const inCooldown = cooldownUntil > nowMs;
  const cooldownSeconds = Math.max(1, Math.ceil((cooldownUntil - nowMs) / 1000));
  const actionLocked = loading || importLoading || inCooldown;

  function startCooldown() {
    setCooldownUntil(Date.now() + ACTION_COOLDOWN_MS);
  }

  async function handleGenerateFromPantry(event: FormEvent) {
    event.preventDefault();
    if (actionLocked) {
      return;
    }

    setError("");
    setLoading(true);
    setRecipes([]);
    try {
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
        startCooldown();
        return;
      }

      setRecipes(payload.recipes);
    } catch {
      setError("Recipe generation failed.");
      startCooldown();
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setSearchError("");
    setSearchLoading(true);
    setSearchResults([]);

    try {
      const response = await fetch(`/api/recipes/search?q=${encodeURIComponent(searchQuery)}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as {
        results?: SearchResult[];
        error?: string;
      };

      if (!response.ok || !payload.results) {
        setSearchError(payload.error || "Search failed");
        return;
      }

      setSearchResults(payload.results);
    } catch {
      setSearchError("Search failed");
    } finally {
      setSearchLoading(false);
    }
  }

  async function importFromUrl(url: string) {
    if (actionLocked) {
      return;
    }

    setImportError("");
    setImportSuccess("");
    setImportLoading(true);

    try {
      const response = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      const payload = (await response.json()) as {
        recipe?: RecipeCandidate;
        source?: { url: string; title?: string };
        error?: { message?: string } | string;
      };

      if (!response.ok || !payload.recipe) {
        const message =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message || "Import failed";
        setImportError(message);
        startCooldown();
        return;
      }

      const merged: RecipeCandidate = {
        ...payload.recipe,
        sourceUrl: payload.source?.url || url
      };
      setRecipes([merged]);
      setImportSuccess("Imported and structured recipe from URL.");
    } catch {
      setImportError("Import failed");
      startCooldown();
    } finally {
      setImportLoading(false);
    }
  }

  async function handleImportSubmit(event: FormEvent) {
    event.preventDefault();
    await importFromUrl(importUrl);
  }

  async function saveRecipe(recipe: RecipeCandidate) {
    setSaveMessage("");

    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: recipe.title,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        notes: recipe.notes,
        promptJson: JSON.stringify({
          source: recipe.sourceUrl ? "url-import" : "pantry-generate",
          sourceUrl: recipe.sourceUrl || null,
          maxTime,
          cuisine,
          dietaryNotes
        })
      })
    });

    const payload = (await response.json()) as {
      error?: string;
      duplicateRecipe?: { id: string; title: string };
    };

    if (response.status === 409 && payload.duplicateRecipe) {
      setSaveMessage(`Skipped duplicate: already saved as "${payload.duplicateRecipe.title}".`);
      return;
    }

    if (!response.ok) {
      setSaveMessage(payload.error || "Failed to save recipe.");
      return;
    }

    setSaveMessage("Recipe saved.");
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Generate Recipes</h1>

      <form className="space-y-3 rounded-xl bg-white p-4 shadow-sm" onSubmit={handleSearch}>
        <h2 className="text-lg font-semibold">Search Recipes Online</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search term (e.g. chickpea tomato rice)"
            value={searchQuery}
          />
          <button className="rounded-md bg-brand-500 px-4 py-2 font-medium text-white" type="submit">
            {searchLoading ? "Searching..." : "Search"}
          </button>
        </div>
        {searchError ? <p className="text-sm text-red-700">{searchError}</p> : null}
        {searchResults.length > 0 ? (
          <ul className="space-y-2">
            {searchResults.map((result) => (
              <li className="rounded-md border border-slate-200 p-3" key={result.url}>
                <p className="font-medium text-slate-800">{result.title}</p>
                <p className="truncate text-sm text-slate-600">{result.url}</p>
                <p className="text-sm text-slate-700">{result.snippet}</p>
                <button
                  className="mt-2 rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={actionLocked}
                  onClick={() => {
                    setImportUrl(result.url);
                    void importFromUrl(result.url);
                  }}
                  type="button"
                >
                  Import This Recipe
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      <form className="space-y-3 rounded-xl bg-white p-4 shadow-sm" onSubmit={handleImportSubmit}>
        <h2 className="text-lg font-semibold">Import From Recipe URL</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => setImportUrl(event.target.value)}
            placeholder="https://example.com/recipe"
            type="url"
            value={importUrl}
          />
          <button
            className="rounded-md bg-brand-500 px-4 py-2 font-medium text-white"
            disabled={actionLocked}
            type="submit"
          >
            {importLoading ? "Importing..." : "Import URL"}
          </button>
        </div>
        {inCooldown ? <p className="text-sm text-amber-700">Rate limit cooldown: retry in {cooldownSeconds}s.</p> : null}
        {importError ? <p className="text-sm text-red-700">{importError}</p> : null}
        {importSuccess ? <p className="text-sm text-green-700">{importSuccess}</p> : null}
      </form>

      <form className="grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-4" onSubmit={handleGenerateFromPantry}>
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
        <button className="rounded-md bg-brand-500 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={actionLocked} type="submit">
          {loading ? "Generating..." : "Generate From Pantry"}
        </button>
      </form>

      {error ? <p className="rounded-md bg-red-100 p-3 text-red-700">{error}</p> : null}
      {saveMessage ? <p className="rounded-md bg-slate-100 p-3 text-slate-700">{saveMessage}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {recipes.map((recipe, index) => (
          <article className="space-y-2 rounded-xl bg-white p-4 shadow-sm" key={`${recipe.title}-${index}`}>
            <h2 className="text-lg font-semibold">{recipe.title}</h2>
            {recipe.sourceUrl ? (
              <p className="text-xs text-slate-500">
                Source: <a className="text-brand-700 underline" href={recipe.sourceUrl} rel="noreferrer" target="_blank">{recipe.sourceUrl}</a>
              </p>
            ) : null}
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
