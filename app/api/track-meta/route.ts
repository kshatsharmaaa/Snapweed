import { NextRequest } from "next/server";

interface TrackMetaResponse {
  coverUrl: string;
  title?: string;
  artist?: string;
  provider?: string;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower.endsWith(".local") ||
    lower.startsWith("10.") ||
    lower.startsWith("192.168.") ||
    lower.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)
  ) {
    return true;
  }
  return false;
}

function extractYouTubeVideoId(urlObj: URL): string | null {
  const host = urlObj.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = urlObj.pathname.replace(/^\//, "").split("/")[0];
    return /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : null;
  }
  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    const vParam = urlObj.searchParams.get("v");
    if (vParam && /^[a-zA-Z0-9_-]{6,20}$/.test(vParam)) {
      return vParam;
    }
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if ((pathParts[0] === "shorts" || pathParts[0] === "embed" || pathParts[0] === "live") && pathParts[1]) {
      return /^[a-zA-Z0-9_-]{6,20}$/.test(pathParts[1]) ? pathParts[1] : null;
    }
  }
  return null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#183;|&middot;/g, "·")
    .trim();
}

function extractOgTag(html: string, propertyName: string): string {
  // Matches both <meta property="og:image" content="..."> and <meta content="..." property="og:image">
  const propFirst = new RegExp(
    `<meta[^>]+(?:property|name)=["']${propertyName}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${propertyName}["']`,
    "i"
  );
  const match = html.match(propFirst) || html.match(contentFirst);
  if (!match?.[1]) return "";
  return decodeHtmlEntities(match[1]);
}

function parseSpotifyHtmlMeta(html: string): { title?: string; artist?: string; coverUrl?: string } {
  const ogImage = extractOgTag(html, "og:image");
  const ogTitle = extractOgTag(html, "og:title");
  const ogDesc = extractOgTag(html, "og:description");
  const musicianDesc = extractOgTag(html, "music:musician_description");

  let parsedTitle = ogTitle || undefined;
  let parsedArtist = musicianDesc || undefined;

  // Parse Spotify <title>: e.g. "Coffee - song and lyrics by beabadoobee | Spotify"
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleTagMatch?.[1]) {
    const rawPageTitle = decodeHtmlEntities(titleTagMatch[1]);
    const spotifyTitleMatch = rawPageTitle.match(
      /^(.+?)\s+-\s+(?:song(?:\s+and\s+lyrics)?|single|album|ep|playlist|podcast|episode)\s+by\s+(.+?)\s*\|\s*Spotify$/i
    );
    if (spotifyTitleMatch) {
      if (!parsedTitle) parsedTitle = spotifyTitleMatch[1].trim();
      if (!parsedArtist) parsedArtist = spotifyTitleMatch[2].trim();
    }
  }

  // Fallback artist extraction from og:description: "Listen to X on Spotify. Artist · Song · 2020."
  if (!parsedArtist && ogDesc) {
    const cleanedDesc = ogDesc.replace(/^Listen to .+ on Spotify\.\s*/i, "").trim();
    if (cleanedDesc.includes("·")) {
      const candidate = cleanedDesc.split("·")[0].trim();
      if (candidate && candidate.toLowerCase() !== "song" && candidate.toLowerCase() !== "album") {
        parsedArtist = candidate;
      }
    }
  }

  return {
    title: parsedTitle,
    artist: parsedArtist,
    coverUrl: ogImage || undefined,
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SnapweedBot/1.0)",
        Accept: "application/json, text/html",
      },
      next: { revalidate: 3600 },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url")?.trim();
  if (!rawUrl) {
    return Response.json({ coverUrl: "" } satisfies TrackMetaResponse, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return Response.json({ coverUrl: "" } satisfies TrackMetaResponse, { status: 400 });
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return Response.json({ coverUrl: "" } satisfies TrackMetaResponse, { status: 400 });
  }

  if (isPrivateOrLocalHostname(parsedUrl.hostname)) {
    return Response.json({ coverUrl: "" } satisfies TrackMetaResponse, { status: 403 });
  }

  const host = parsedUrl.hostname.toLowerCase();

  try {
    // 1. Spotify links (open.spotify.com, spotify.link)
    if (host.includes("spotify.com") || host === "spotify.link") {
      let targetUrl = rawUrl;

      // Resolve short spotify.link redirect if needed
      if (host === "spotify.link") {
        try {
          const redirectRes = await fetchWithTimeout(rawUrl, 3500);
          if (redirectRes.url && redirectRes.url.includes("spotify.com")) {
            targetUrl = redirectRes.url;
          }
        } catch {
          // Continue with original URL
        }
      }

      // Normalize /intl-xx/ prefix if present so Spotify oEmbed always recognizes it
      const normalizedSpotify = targetUrl.replace(
        /open\.spotify\.com\/intl-[a-z-]+\//i,
        "open.spotify.com/"
      );

      let spotifyParsed: URL | null = null;
      try {
        spotifyParsed = new URL(normalizedSpotify);
      } catch {}

      const isSpecificSpotifyItem = spotifyParsed
        ? /\/(track|album|playlist|episode|show|artist)\//i.test(spotifyParsed.pathname)
        : false;

      if (!isSpecificSpotifyItem) {
        return Response.json({ coverUrl: "" } satisfies TrackMetaResponse);
      }

      // Fetch Spotify oEmbed and HTML meta in parallel to reliably capture cover, title, and artist
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(normalizedSpotify)}`;
      const [oembedResult, htmlResult] = await Promise.allSettled([
        fetchWithTimeout(oembedUrl, 4500).then((r) => (r.ok ? r.json() : null)),
        fetchWithTimeout(normalizedSpotify, 4500).then((r) => (r.ok ? r.text() : "")),
      ]);

      const oembedData =
        oembedResult.status === "fulfilled" && oembedResult.value
          ? (oembedResult.value as {
              thumbnail_url?: string;
              title?: string;
              author_name?: string;
            })
          : null;

      const htmlMeta =
        htmlResult.status === "fulfilled" && htmlResult.value
          ? parseSpotifyHtmlMeta(htmlResult.value)
          : {};

      const coverUrl = oembedData?.thumbnail_url || htmlMeta.coverUrl || "";
      const title = oembedData?.title || htmlMeta.title;
      const artist = oembedData?.author_name || htmlMeta.artist;

      return Response.json({
        coverUrl,
        title,
        artist,
        provider: "spotify",
      } satisfies TrackMetaResponse);
    }

    // 2. YouTube & YouTube Music links
    const ytVideoId = extractYouTubeVideoId(parsedUrl);
    if (ytVideoId || host.includes("youtube.com") || host === "youtu.be") {
      const watchUrl = ytVideoId
        ? `https://www.youtube.com/watch?v=${ytVideoId}`
        : rawUrl;
      const fallbackThumb = ytVideoId
        ? `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`
        : "";

      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
        const res = await fetchWithTimeout(oembedUrl, 4500);
        if (res.ok) {
          const data = (await res.json()) as {
            thumbnail_url?: string;
            title?: string;
            author_name?: string;
          };
          const cleanArtist = data.author_name
            ? data.author_name.replace(/\s*-\s*Topic$/i, "").trim()
            : undefined;
          return Response.json({
            coverUrl: data.thumbnail_url || fallbackThumb,
            title: data.title || undefined,
            artist: cleanArtist,
            provider: host.includes("music.youtube") ? "youtube_music" : "youtube",
          } satisfies TrackMetaResponse);
        }
      } catch {
        // Fallback to direct YouTube image CDN URL
      }

      if (fallbackThumb) {
        return Response.json({
          coverUrl: fallbackThumb,
          provider: host.includes("music.youtube") ? "youtube_music" : "youtube",
        } satisfies TrackMetaResponse);
      }
    }

    // 3. SoundCloud links
    if (host.includes("soundcloud.com")) {
      try {
        const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(rawUrl)}`;
        const res = await fetchWithTimeout(oembedUrl, 4500);
        if (res.ok) {
          const data = (await res.json()) as {
            thumbnail_url?: string;
            title?: string;
            author_name?: string;
          };
          return Response.json({
            coverUrl: data.thumbnail_url || "",
            title: data.title || undefined,
            artist: data.author_name || undefined,
            provider: "soundcloud",
          } satisfies TrackMetaResponse);
        }
      } catch {
        // Fallback below
      }
    }

    // 4. Apple Music / Bandcamp / Other supported music links via OpenGraph tags
    const allowedMusicOgHosts = ["music.apple.com", "bandcamp.com", "tidal.com", "deezer.com"];
    if (allowedMusicOgHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      try {
        const htmlRes = await fetchWithTimeout(rawUrl, 4500);
        if (htmlRes.ok) {
          const html = await htmlRes.text();
          const ogImage = extractOgTag(html, "og:image");
          const ogTitle = extractOgTag(html, "og:title");
          return Response.json({
            coverUrl: ogImage || "",
            title: ogTitle || undefined,
            provider: "other",
          } satisfies TrackMetaResponse);
        }
      } catch {
        // Ignore
      }
    }

    return Response.json({ coverUrl: "" } satisfies TrackMetaResponse);
  } catch {
    return Response.json({ coverUrl: "" } satisfies TrackMetaResponse);
  }
}
