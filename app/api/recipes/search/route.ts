import { NextResponse } from "next/server";

const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeResultUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) {
      return decodeURIComponent(uddg);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function parseSearchResults(html: string): SearchResult[] {
  const linkMatches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippetMatches = [...html.matchAll(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/gi)];

  const results: SearchResult[] = [];

  for (let index = 0; index < linkMatches.length; index += 1) {
    const link = linkMatches[index];
    const rawHref = link[1] || "";
    const rawTitle = link[2] || "";
    const snippetMatch = snippetMatches[index];
    const rawSnippet = snippetMatch?.[1] || snippetMatch?.[2] || "";

    const title = decodeHtml(rawTitle.replace(/<[^>]+>/g, " "));
    const url = normalizeResultUrl(decodeHtml(rawHref));
    const snippet = decodeHtml(rawSnippet.replace(/<[^>]+>/g, " "));

    if (!title || !url.startsWith("http")) {
      continue;
    }

    results.push({ title, url, snippet });
    if (results.length >= 8) {
      break;
    }
  }

  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (q.length > 120) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const searchUrl = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(`${q} recipe`)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 PantryPilot/1.0",
        "Accept-Language": "en-US,en;q=0.9"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Search request failed" }, { status: 502 });
    }

    const html = await response.text();
    const results = parseSearchResults(html);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Recipe search failed", error);
    return NextResponse.json({ error: "Recipe search failed" }, { status: 502 });
  }
}
