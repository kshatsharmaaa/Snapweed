"use client";

export interface TrackMetadata {
  coverUrl: string;
  title?: string;
  artist?: string;
  provider?: string;
}

const memoryCache = new Map<string, TrackMetadata>();

export function isMusicUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export function getProviderNameFromUrl(rawUrl: string): string {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    if (host.includes("spotify")) return "Spotify";
    if (host.includes("music.youtube")) return "YouTube Music";
    if (host.includes("youtube") || host === "youtu.be") return "YouTube";
    if (host.includes("soundcloud")) return "SoundCloud";
    if (host.includes("music.apple")) return "Apple Music";
  } catch {}
  return "Shared Link";
}

export function getQuickYouTubeThumb(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be") {
      id = parsed.pathname.replace(/^\//, "").split("/")[0];
    } else if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      id = parsed.searchParams.get("v") || "";
    }
    if (id && /^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
      return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  } catch {}
  return "";
}

export async function fetchTrackMetadata(rawUrl: string): Promise<TrackMetadata> {
  const trimmed = rawUrl.trim();
  if (!isMusicUrl(trimmed)) {
    return { coverUrl: "" };
  }

  if (memoryCache.has(trimmed)) {
    return memoryCache.get(trimmed)!;
  }

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`snapweed_track_meta_${trimmed}`);
      if (cached) {
        const parsed = JSON.parse(cached) as TrackMetadata;
        if (parsed.coverUrl && parsed.title && parsed.artist) {
          memoryCache.set(trimmed, parsed);
          return parsed;
        }
      }
    } catch {}
  }

  try {
    const res = await fetch(`/api/track-meta?url=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = (await res.json()) as TrackMetadata;
      const result: TrackMetadata = {
        coverUrl: data.coverUrl || getQuickYouTubeThumb(trimmed) || "",
        title: data.title,
        artist: data.artist,
        provider: data.provider,
      };
      memoryCache.set(trimmed, result);
      if (typeof window !== "undefined" && result.coverUrl) {
        try {
          localStorage.setItem(`snapweed_track_meta_${trimmed}`, JSON.stringify(result));
        } catch {}
      }
      return result;
    }
  } catch {
    // Fallback to quick YouTube URL thumb
  }

  const quickYt = getQuickYouTubeThumb(trimmed);
  return { coverUrl: quickYt };
}

