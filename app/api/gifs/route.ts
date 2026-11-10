import { NextRequest } from "next/server";

interface GifItem {
  id: string;
  url: string;
  title: string;
}

const SAFE_CATEGORIES = [
  "wave",
  "happy",
  "laugh",
  "dance",
  "clap",
  "thumbsup",
  "hug",
  "highfive",
  "smile",
  "wink",
  "sip",
  "sleep",
  "think",
  "shrug",
  "nod",
  "blush",
  "facepalm",
  "cry",
] as const;

const QUERY_CATEGORY_ALIASES: Record<string, (typeof SAFE_CATEGORIES)[number]> = {
  hi: "wave",
  hello: "wave",
  hey: "wave",
  bye: "wave",
  haha: "laugh",
  lol: "laugh",
  lmao: "laugh",
  funny: "laugh",
  yay: "happy",
  excited: "happy",
  party: "dance",
  vibe: "dance",
  tea: "sip",
  coffee: "sip",
  drink: "sip",
  yes: "nod",
  ok: "thumbsup",
  good: "thumbsup",
  nice: "thumbsup",
  love: "hug",
  tired: "sleep",
  sleepy: "sleep",
  sad: "cry",
  oops: "facepalm",
};

function mapSafeCategory(input: string): string | null {
  const clean = input.trim().toLowerCase().replace(/\s+/g, "");
  if ((SAFE_CATEGORIES as readonly string[]).includes(clean)) {
    return clean;
  }
  if (clean in QUERY_CATEGORY_ALIASES) {
    return QUERY_CATEGORY_ALIASES[clean];
  }
  return null;
}

async function fetchJsonWithTimeout(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers,
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const categoryParam = request.nextUrl.searchParams.get("category")?.trim() || "wave";

  // 1. If Giphy key is present in env, support full Giphy search/trending
  const giphyKey = process.env.GIPHY_API_KEY;
  if (giphyKey) {
    const endpoint = q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(q)}&limit=16&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(giphyKey)}&limit=16&rating=pg-13`;
    const giphyData = (await fetchJsonWithTimeout(endpoint)) as {
      data?: Array<{
        id: string;
        title?: string;
        images?: { fixed_width?: { url?: string }; original?: { url?: string } };
      }>;
    } | null;

    if (giphyData?.data?.length) {
      const gifs: GifItem[] = giphyData.data
        .map((item) => ({
          id: item.id,
          url: item.images?.fixed_width?.url || item.images?.original?.url || "",
          title: item.title || "GIF",
        }))
        .filter((g) => Boolean(g.url));
      return Response.json({ gifs });
    }
  }

  // 2. If Tenor key is present in env, support Tenor v2 search
  const tenorKey = process.env.TENOR_API_KEY;
  if (tenorKey) {
    const endpoint = q
      ? `https://tenor.googleapis.com/v2/search?key=${encodeURIComponent(tenorKey)}&q=${encodeURIComponent(q)}&limit=16&media_filter=gif,tinygif`
      : `https://tenor.googleapis.com/v2/featured?key=${encodeURIComponent(tenorKey)}&limit=16&media_filter=gif,tinygif`;
    const tenorData = (await fetchJsonWithTimeout(endpoint)) as {
      results?: Array<{
        id: string;
        content_description?: string;
        media_formats?: { tinygif?: { url?: string }; gif?: { url?: string } };
      }>;
    } | null;

    if (tenorData?.results?.length) {
      const gifs: GifItem[] = tenorData.results
        .map((item) => ({
          id: item.id,
          url: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || "",
          title: item.content_description || "GIF",
        }))
        .filter((g) => Boolean(g.url));
      return Response.json({ gifs });
    }
  }

  // 3. Keyless SFW Reaction GIFs via nekos.best/api/v2
  const headers = {
    "User-Agent": "SnapweedChatApp/1.0 (https://snapweed.app)",
    Accept: "application/json",
  };

  let endpoint = "";
  const resolvedCategory = q ? mapSafeCategory(q) : mapSafeCategory(categoryParam) || "wave";

  if (resolvedCategory) {
    endpoint = `https://nekos.best/api/v2/${resolvedCategory}?amount=12`;
  } else {
    endpoint = `https://nekos.best/api/v2/search?query=${encodeURIComponent(q)}&type=2&amount=12`;
  }

  let data = (await fetchJsonWithTimeout(endpoint, headers)) as {
    results?: Array<{ url?: string; anime_name?: string }>;
  } | null;

  // Fallback to "happy" reaction GIFs if keyword query returns 0 items
  if (!data?.results?.length && q) {
    data = (await fetchJsonWithTimeout(
      `https://nekos.best/api/v2/happy?amount=12`,
      headers
    )) as { results?: Array<{ url?: string; anime_name?: string }> } | null;
  }

  const seen = new Set<string>();
  const gifs: GifItem[] = [];
  if (Array.isArray(data?.results)) {
    data.results.forEach((item, idx) => {
      if (!item.url || seen.has(item.url)) return;
      seen.add(item.url);
      gifs.push({
        id: `gif_${idx}_${item.url.slice(-12)}`,
        url: item.url,
        title: item.anime_name || resolvedCategory || q || "Reaction GIF",
      });
    });
  }

  return Response.json({ gifs });
}

