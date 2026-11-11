"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  doc, 
  updateDoc, 
  increment, 
  arrayUnion,
  arrayRemove,
  deleteField,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  fetchTrackMetadata,
  getProviderNameFromUrl,
  isMusicUrl,
  TrackMetadata,
} from "@/lib/track-meta";
import { TrackCover } from "./TrackCover";
import { useUserPhotoDirectory, resolveAuthorPhoto } from "@/lib/user-avatars";
import { UserAvatar } from "./UserAvatar";

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  link?: string;
  coverUrl?: string;
  note?: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorPhoto?: string;
  likes?: number;
  likedBy?: string[];
  likeMeta?: Record<string, { username: string; name: string; at: number }>;
  createdAt?: unknown;
}

interface SongsBoardProps {
  currentUid: string;
  currentUsername: string;
  currentName: string;
  currentPhoto?: string;
}

function generateLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

function currentEpochMillis(): number {
  return Date.now();
}

const STARTER_SONGS: SongItem[] = [
  {
    id: "song_starter_1",
    title: "Coffee",
    artist: "beabadoobee",
    link: "",
    note: "For quiet morning coffee and pastel sunlight.",
    authorId: "snapweed_seed",
    authorUsername: "maya",
    authorName: "Maya",
    likes: 6,
    likedBy: ["seed_1", "seed_2", "seed_3", "seed_4", "seed_5", "seed_6"],
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: "song_starter_2",
    title: "Sunset Lover",
    artist: "Petit Biscuit",
    link: "",
    note: "Clean late-night electronic track.",
    authorId: "snapweed_seed",
    authorUsername: "sam",
    authorName: "Sam",
    likes: 9,
    likedBy: ["seed_1", "seed_2", "seed_3", "seed_4", "seed_5", "seed_6", "seed_7", "seed_8", "seed_9"],
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: "song_starter_3",
    title: "Warm Foothills",
    artist: "alt-J",
    link: "",
    note: "Acoustic guitars and vocals.",
    authorId: "snapweed_seed",
    authorUsername: "elena",
    authorName: "Elena",
    likes: 4,
    likedBy: ["seed_1", "seed_2", "seed_3", "seed_4"],
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
];

function getStoredLocalSongs(): SongItem[] {
  if (typeof window === "undefined") return STARTER_SONGS;
  try {
    const raw = localStorage.getItem("snapweed_local_songs");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return STARTER_SONGS;
}

function persistLocalSongs(items: SongItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("snapweed_local_songs", JSON.stringify(items));
  } catch {}
}

export function SongsBoard({
  currentUid,
  currentUsername,
  currentName,
  currentPhoto = "",
}: SongsBoardProps) {
  const [songs, setSongs] = useState<SongItem[]>(() => getStoredLocalSongs());
  const [showAddForm, setShowAddForm] = useState(false);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [previewMeta, setPreviewMeta] = useState<(TrackMetadata & { forUrl: string }) | null>(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const photoDir = useUserPhotoDirectory();

  // Sync songs from Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, "song_recommendations"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as SongItem[];

          items.sort((a, b) => {
            const timeA = (a.createdAt as { toMillis?: () => number })?.toMillis
              ? (a.createdAt as { toMillis: () => number }).toMillis()
              : typeof a.createdAt === "string"
              ? new Date(a.createdAt).getTime()
              : 0;
            const timeB = (b.createdAt as { toMillis?: () => number })?.toMillis
              ? (b.createdAt as { toMillis: () => number }).toMillis()
              : typeof b.createdAt === "string"
              ? new Date(b.createdAt).getTime()
              : 0;
            return timeB - timeA;
          });

          if (items.length > 0) {
            setSongs(items);
            persistLocalSongs(items);
          }
        },
        (err) => {
          if (err.code === "permission-denied" || err.message?.includes("permissions")) {
            setSongs(getStoredLocalSongs());
          } else {
            console.warn("Firestore songs sync notice:", err.message);
          }
        }
      );

      return () => unsubscribe();
    } catch {
      // Retain current local songs
    }
  }, []);

  // Automatically fetch track title, artist, and album cover from Spotify / YouTube link
  useEffect(() => {
    const clean = link.trim();
    if (!isMusicUrl(clean)) {
      const resetTimer = setTimeout(() => {
        setPreviewMeta(null);
        setFetchingMeta(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!cancelled) setFetchingMeta(true);
      const meta = await fetchTrackMetadata(clean);
      if (cancelled) return;

      setPreviewMeta({ ...meta, forUrl: clean });
      setFetchingMeta(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [link]);

  const activePreview =
    previewMeta && previewMeta.forUrl === link.trim() ? previewMeta : null;

  const handleCreateSong = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLink = link.trim();
    if (!isMusicUrl(cleanLink)) {
      setFormError("Please paste a valid Spotify, YouTube Music, or track link.");
      return;
    }

    setFormError("");
    setSubmitting(true);

    // Fetch metadata from link if not yet resolved
    const meta =
      activePreview || (await fetchTrackMetadata(cleanLink));

    const providerLabel = getProviderNameFromUrl(cleanLink);
    const resolvedTitle = meta.title?.trim() || `${providerLabel} Track`;
    const resolvedArtist = meta.artist?.trim() || providerLabel;
    const resolvedCover = meta.coverUrl || "";

    const newSongItem: SongItem = {
      id: generateLocalId("song"),
      title: resolvedTitle,
      artist: resolvedArtist,
      link: cleanLink,
      coverUrl: resolvedCover,
      note: note.trim() || "",
      authorId: currentUid,
      authorUsername: currentUsername,
      authorName: currentName || currentUsername,
      authorPhoto: currentPhoto || "",
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };

    // Optimistically update local state & persistence immediately
    setSongs((prev) => {
      const updated = [newSongItem, ...prev.filter((s) => s.id !== newSongItem.id)];
      persistLocalSongs(updated);
      return updated;
    });

    setLink("");
    setNote("");
    setPreviewMeta(null);
    setShowAddForm(false);

    try {
      await addDoc(collection(db, "song_recommendations"), {
        title: newSongItem.title,
        artist: newSongItem.artist,
        link: newSongItem.link,
        coverUrl: newSongItem.coverUrl,
        note: newSongItem.note,
        authorId: currentUid,
        authorUsername: currentUsername,
        authorName: currentName || currentUsername,
        authorPhoto: currentPhoto || "",
        likes: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code !== "permission-denied") {
        console.warn("Saved song recommendation locally:", errObj.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (sId: string) => {
    if (!currentUid) return;

    const targetSong = songs.find((s) => s.id === sId);
    if (!targetSong) return;

    const currentLikedBy = Array.isArray(targetSong.likedBy) ? targetSong.likedBy : [];
    const isLiked = currentLikedBy.includes(currentUid);

    const nextLikedBy = isLiked
      ? currentLikedBy.filter((uid) => uid !== currentUid)
      : [...currentLikedBy, currentUid];

    const nextLikes = isLiked
      ? Math.max(0, (targetSong.likes || 1) - 1)
      : (targetSong.likes || 0) + 1;

    const nowAt = currentEpochMillis();
    const nextLikeMeta = { ...(targetSong.likeMeta || {}) };
    if (isLiked) {
      delete nextLikeMeta[currentUid];
    } else {
      nextLikeMeta[currentUid] = {
        username: currentUsername,
        name: currentName || currentUsername,
        at: nowAt,
      };
    }

    // Optimistically update local state & persistence
    setSongs((prev) => {
      const updated = prev.map((s) =>
        s.id === sId ? { ...s, likes: nextLikes, likedBy: nextLikedBy, likeMeta: nextLikeMeta } : s
      );
      persistLocalSongs(updated);
      return updated;
    });

    try {
      const songRef = doc(db, "song_recommendations", sId);
      await updateDoc(songRef, {
        likes: isLiked ? increment(-1) : increment(1),
        likedBy: isLiked ? arrayRemove(currentUid) : arrayUnion(currentUid),
        [`likeMeta.${currentUid}`]: isLiked
          ? deleteField()
          : {
              username: currentUsername,
              name: currentName || currentUsername,
              at: nowAt,
            },
      });
    } catch {
      // Ignored if local or rules not yet applied
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Open Editorial Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 px-1">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-[var(--pastel-text)] tracking-tight">
            Soundtrack &amp; Songs
          </h3>
          <p className="text-xs text-[var(--pastel-subtext)] mt-0.5">
            Paste a Spotify or YouTube Music link &bull; title, artist &amp; cover auto-load
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setFormError("");
          }}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all portfolio-shadow cursor-pointer ${
            showAddForm
              ? "bg-[var(--pastel-card)] text-[var(--pastel-text)]"
              : "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] hover:opacity-90"
          }`}
        >
          {showAddForm ? "Cancel" : "+ Share Link"}
        </button>
      </div>

      {/* Share Track Link Form (Link Only) */}
      {showAddForm && (
        <form onSubmit={handleCreateSong} className="p-5 sm:p-6 bg-[var(--pastel-card)] rounded-3xl portfolio-shadow space-y-3.5">
          {formError && (
            <div
              className="p-3 text-xs font-bold rounded-2xl"
              style={{
                backgroundColor: "var(--pastel-error-bg)",
                color: "var(--pastel-error-text)",
              }}
            >
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1.5">
              Song Link * (Spotify, YouTube Music, or SoundCloud)
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                if (formError) setFormError("");
              }}
              placeholder="https://open.spotify.com/track/..."
              className="w-full px-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] text-xs text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
              required
            />
          </div>

          {/* Live Resolved Track Preview */}
          {isMusicUrl(link) && (
            <div className="flex items-center gap-3 p-3 bg-[var(--pastel-tint)] rounded-2xl">
              <TrackCover
                url={link}
                savedCoverUrl={activePreview?.coverUrl}
                sizeClass="w-12 h-12"
              />
              <div className="min-w-0 flex-1">
                {fetchingMeta ? (
                  <>
                    <p className="text-xs font-bold text-[var(--pastel-text)]">
                      Fetching song details...
                    </p>
                    <p className="text-[11px] text-[var(--pastel-subtext)]">
                      Getting title, artist &amp; cover artwork
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-[var(--pastel-text)] truncate">
                      {activePreview?.title || `${getProviderNameFromUrl(link)} Track`}
                    </p>
                    <p className="text-[11px] text-[var(--pastel-subtext)] truncate">
                      {activePreview?.artist || getProviderNameFromUrl(link)}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1.5">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Late-night study track"
              className="w-full px-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] text-xs text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={submitting || !link.trim()}
              className="px-5 py-2 bg-[var(--pastel-primary)] hover:opacity-90 text-[var(--pastel-on-primary)] rounded-full text-xs font-bold transition-all portfolio-shadow disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Sharing..." : "Share Track"}
            </button>
          </div>
        </form>
      )}

      {/* Songs List — Borderless Elevated Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {songs.length === 0 ? (
          <div className="col-span-full text-center py-10 text-xs text-[var(--pastel-subtext)] bg-[var(--pastel-card)] rounded-3xl portfolio-shadow">
            No tracks recommended yet ~ paste a Spotify link to share one!
          </div>
        ) : (
          songs.map((s) => {
            const isLiked = Array.isArray(s.likedBy) && s.likedBy.includes(currentUid);
            const authorPhoto = resolveAuthorPhoto(photoDir, {
              authorId: s.authorId,
              authorPhoto: s.authorPhoto,
              authorName: s.authorName,
              authorUsername: s.authorUsername,
              currentUid,
              currentPhoto,
              currentName,
              currentUsername,
            });
            return (
              <div
                key={s.id}
                className="p-5 bg-[var(--pastel-card)] rounded-3xl portfolio-shadow transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <TrackCover
                        url={s.link}
                        savedCoverUrl={s.coverUrl}
                        alt={s.title}
                        sizeClass="w-12 h-12"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[var(--pastel-text)] truncate">
                          {s.title}
                        </h4>
                        <p className="text-xs text-[var(--pastel-subtext)] truncate">
                          {s.artist}
                        </p>
                      </div>
                    </div>
                    {s.link && (
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-[var(--pastel-tint)] hover:opacity-85 text-[var(--pastel-accent-text)] rounded-full text-[11px] font-bold shrink-0"
                      >
                        Listen
                      </a>
                    )}
                  </div>

                  {s.note && (
                    <p className="text-xs italic text-[var(--pastel-text)] bg-[var(--pastel-tint)] p-3 rounded-2xl mt-3 opacity-95">
                      &ldquo;{s.note}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex justify-between items-center mt-4 pt-2 text-[11px] text-[var(--pastel-subtext)]">
                  <div className="flex items-center gap-1.5">
                    <UserAvatar
                      name={s.authorName || s.authorUsername}
                      photoUrl={authorPhoto}
                      sizeClass="w-5 h-5"
                      textClass="text-[9px]"
                      bgClass="bg-[var(--pastel-tint)]"
                    />
                    <span className="font-medium">@{s.authorUsername}</span>
                  </div>

                  <button
                    onClick={() => handleLike(s.id)}
                    title={isLiked ? "Click to unlike" : "Click to like"}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1 rounded-full transition-all cursor-pointer ${
                      isLiked
                        ? "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] shadow-2xs scale-[1.03]"
                        : "bg-[var(--pastel-tint)] text-[var(--pastel-accent-text)] hover:opacity-85"
                    }`}
                  >
                    <span>{isLiked ? "Liked" : "Like"}</span>
                    <span className="font-semibold">{s.likes || 0}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
