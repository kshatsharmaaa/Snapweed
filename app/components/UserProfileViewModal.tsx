"use client";

import { useState, useEffect } from "react";
import { getUserProfile, UserProfileData } from "@/lib/user-profile";
import { getPastelPalette, DEFAULT_THEME_ID } from "@/lib/pastel-themes";
import { useStoredThemeMode } from "@/lib/usePastelTheme";
import { TrackCover } from "./TrackCover";
import { fetchTrackMetadata, isMusicUrl } from "@/lib/track-meta";

interface UserProfileViewModalProps {
  uid: string | null;
  fallbackName?: string;
  fallbackUsername?: string;
  fallbackPhoto?: string;
  onClose: () => void;
}

export function UserProfileViewModal({
  uid,
  fallbackName = "Friend",
  fallbackUsername = "",
  fallbackPhoto = "",
  onClose,
}: UserProfileViewModalProps) {
  const themeMode = useStoredThemeMode();
  const [loadedProfile, setLoadedProfile] = useState<{
    forUid: string;
    data: UserProfileData | null;
  } | null>(null);
  const [resolvedSong, setResolvedSong] = useState<{
    forSong: string;
    title?: string;
    artist?: string;
  } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getUserProfile(uid)
      .then((data) => {
        if (!cancelled) {
          setLoadedProfile({ forUid: uid, data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedProfile({ forUid: uid, data: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const activeData =
    uid && loadedProfile && loadedProfile.forUid === uid ? loadedProfile.data : null;

  const favSong = activeData?.favSong || "";

  useEffect(() => {
    if (!favSong || !isMusicUrl(favSong)) return;
    let cancelled = false;
    fetchTrackMetadata(favSong).then((meta) => {
      if (!cancelled) {
        setResolvedSong({ forSong: favSong, title: meta.title, artist: meta.artist });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [favSong]);

  if (!uid) return null;

  const isLoading = !loadedProfile || loadedProfile.forUid !== uid;
  const displayName = activeData?.name || fallbackName || "Friend";
  const rawUsername = activeData?.username || fallbackUsername || "";
  const cleanUsername = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername;
  const displayPhoto = activeData?.photoURL || fallbackPhoto || "";

  const themeKey = activeData?.themeColor || DEFAULT_THEME_ID;
  const themeObj = getPastelPalette(themeKey, themeMode);

  const songMeta =
    resolvedSong && resolvedSong.forSong === favSong ? resolvedSong : null;
  const songLabel = songMeta?.title
    ? songMeta.artist
      ? `${songMeta.title} — ${songMeta.artist}`
      : songMeta.title
    : favSong;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="max-w-sm w-full bg-[var(--pastel-card)] portfolio-panel p-6 portfolio-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between pb-3 mb-4 border-b"
          style={{ borderColor: "var(--pastel-border)" }}
        >
          <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--pastel-subtext)" }}>
            Member Profile
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
            style={{
              backgroundColor: "var(--pastel-tint)",
              color: "var(--pastel-text)",
            }}
            aria-label="Close profile"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Avatar & Name */}
        <div className="flex flex-col items-center text-center">
          <div
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-black shadow-xs mb-3"
            style={{
              backgroundColor: themeObj.tint,
              color: themeObj.primary,
            }}
          >
            {displayPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayPhoto} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span>{displayName.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <h3 className="text-lg font-extrabold" style={{ color: "var(--pastel-text)" }}>
            {displayName}
          </h3>

          {cleanUsername && (
            <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--pastel-subtext)" }}>
              @{cleanUsername}
            </p>
          )}

          {/* Active Theme Pill */}
          <div
            className="mt-3 px-3.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5"
            style={{
              backgroundColor: themeObj.tint,
              color: themeObj.text,
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: themeObj.primary }}
            />
            <span>{themeObj.name} Theme</span>
          </div>
        </div>

        {/* Favorite Song Section */}
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--pastel-border)" }}>
          {isLoading ? (
            <p className="text-center text-xs py-2" style={{ color: "var(--pastel-subtext)" }}>
              Loading profile details...
            </p>
          ) : favSong ? (
            <div
              className="p-3.5 rounded-2xl flex items-center gap-3"
              style={{
                backgroundColor: "var(--pastel-tint)",
              }}
            >
              {isMusicUrl(favSong) && (
                <TrackCover url={favSong} alt="Favorite track" sizeClass="w-10 h-10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--pastel-subtext)" }}>
                  Favorite Song
                </p>
                {isMusicUrl(favSong) ? (
                  <a
                    href={favSong}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold underline truncate block hover:opacity-80"
                    style={{ color: "var(--pastel-text)" }}
                  >
                    {songLabel}
                  </a>
                ) : (
                  <p className="text-xs font-bold truncate" style={{ color: "var(--pastel-text)" }}>
                    {favSong}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-xs py-1" style={{ color: "var(--pastel-subtext)" }}>
              No favorite song added yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

