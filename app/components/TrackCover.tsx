"use client";

import { useState, useEffect } from "react";
import { fetchTrackMetadata, getQuickYouTubeThumb, isMusicUrl } from "@/lib/track-meta";

interface TrackCoverProps {
  url?: string;
  savedCoverUrl?: string;
  alt?: string;
  sizeClass?: string;
}

export function TrackCover({
  url = "",
  savedCoverUrl = "",
  alt = "Track artwork",
  sizeClass = "w-12 h-12",
}: TrackCoverProps) {
  const [fetched, setFetched] = useState<{ forUrl: string; src: string } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string>("");

  const resolvedQuick = !savedCoverUrl && url && isMusicUrl(url) ? getQuickYouTubeThumb(url) : "";
  const resolvedFetched = fetched && fetched.forUrl === url ? fetched.src : "";
  const activeCover = savedCoverUrl || resolvedFetched || resolvedQuick;

  useEffect(() => {
    if (savedCoverUrl || !url || !isMusicUrl(url)) return;

    let cancelled = false;
    fetchTrackMetadata(url).then((meta) => {
      if (!cancelled && meta.coverUrl) {
        setFetched({ forUrl: url, src: meta.coverUrl });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [url, savedCoverUrl]);

  if (activeCover && failedSrc !== activeCover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={activeCover}
        alt={alt}
        onError={() => setFailedSrc(activeCover)}
        className={`${sizeClass} rounded-xl object-cover shrink-0 bg-[var(--pastel-tint)] shadow-2xs`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl shrink-0 flex items-center justify-center shadow-2xs`}
      style={{
        backgroundColor: "var(--pastel-tint)",
        color: "var(--pastel-accent-text)",
      }}
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </div>
  );
}

export function FavoriteSongBanner({
  favSong,
  onChangeClick,
}: {
  favSong: string;
  onChangeClick: () => void;
}) {
  const isUrl = isMusicUrl(favSong);
  const [resolved, setResolved] = useState<{
    forUrl: string;
    title?: string;
    artist?: string;
  } | null>(null);

  useEffect(() => {
    if (!isUrl) return;
    let cancelled = false;
    fetchTrackMetadata(favSong).then((meta) => {
      if (!cancelled) {
        setResolved({ forUrl: favSong, title: meta.title, artist: meta.artist });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [favSong, isUrl]);

  const activeResolved = resolved && resolved.forUrl === favSong ? resolved : null;
  const label = activeResolved?.title
    ? activeResolved.artist
      ? `${activeResolved.title} — ${activeResolved.artist}`
      : activeResolved.title
    : favSong;

  return (
    <div className="inline-flex max-w-full items-center justify-between gap-3 px-3.5 py-2 bg-[var(--pastel-card)] rounded-2xl portfolio-shadow text-xs text-[var(--pastel-text)]">
      <div className="flex items-center gap-2.5 min-w-0">
        {isUrl ? (
          <TrackCover url={favSong} alt="Favorite Song Artwork" sizeClass="w-8 h-8" />
        ) : (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: "var(--portfolio-green)" }}
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 truncate">
          <span className="font-semibold text-[var(--pastel-subtext)] mr-1.5">Listening to</span>
          {isUrl ? (
            <a
              href={favSong}
              target="_blank"
              rel="noreferrer"
              className="font-bold hover:underline truncate"
              style={{ color: "var(--pastel-accent-text)" }}
            >
              {label}
            </a>
          ) : (
            <span className="font-bold italic">{favSong}</span>
          )}
        </div>
      </div>
      <button
        onClick={onChangeClick}
        className="px-2.5 py-1 rounded-full bg-[var(--pastel-tint)] text-[10px] font-bold hover:opacity-85 shrink-0 cursor-pointer transition-opacity"
        style={{ color: "var(--pastel-accent-text)" }}
      >
        Edit
      </button>
    </div>
  );
}
