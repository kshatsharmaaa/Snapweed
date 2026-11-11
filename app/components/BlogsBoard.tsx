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

export interface BlogItem {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorPhoto?: string;
  likes?: number;
  likedBy?: string[];
  likeMeta?: Record<string, { username: string; name: string; at: number }>;
  createdAt?: unknown;
}

interface BlogsBoardProps {
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

const STARTER_BLOGS: BlogItem[] = [
  {
    id: "blog_starter_1",
    title: "Quiet morning thoughts and coffee",
    content: "Woke up before the sun today. Everything feels slower and softer in the early hours. Sometimes the best progress is simply taking a moment to breathe and listen to the birds outside.",
    authorId: "snapweed_seed",
    authorUsername: "clara",
    authorName: "Clara",
    likes: 4,
    likedBy: ["seed_1", "seed_2", "seed_3", "seed_4"],
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "blog_starter_2",
    title: "The joy of finishing small things",
    content: "Tidied up my desk, made a fresh cup of tea, and wrote two pages in my notebook. We often overestimate what we need to get done in a day and underestimate the calm of finishing one small thing.",
    authorId: "snapweed_seed",
    authorUsername: "leo",
    authorName: "Leo",
    likes: 7,
    likedBy: ["seed_1", "seed_2", "seed_3", "seed_4", "seed_5", "seed_6", "seed_7"],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

function getStoredLocalBlogs(): BlogItem[] {
  if (typeof window === "undefined") return STARTER_BLOGS;
  try {
    const raw = localStorage.getItem("snapweed_local_blogs");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return STARTER_BLOGS;
}

function persistLocalBlogs(items: BlogItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("snapweed_local_blogs", JSON.stringify(items));
  } catch {}
}

export function BlogsBoard({
  currentUid,
  currentUsername,
  currentName,
  currentPhoto = "",
}: BlogsBoardProps) {
  const [blogs, setBlogs] = useState<BlogItem[]>(() => getStoredLocalBlogs());
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const q = query(collection(db, "blogs"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as BlogItem[];

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
            setBlogs(items);
            persistLocalBlogs(items);
          }
        },
        (err) => {
          if (err.code === "permission-denied" || err.message?.includes("permissions")) {
            setBlogs(getStoredLocalBlogs());
          } else {
            console.warn("Firestore blogs sync notice:", err.message);
          }
        }
      );

      return () => unsubscribe();
    } catch {
      // Retain current local blogs
    }
  }, []);

  const handleCreateBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    const newBlogItem: BlogItem = {
      id: generateLocalId("blog"),
      title: title.trim(),
      content: content.trim(),
      authorId: currentUid,
      authorUsername: currentUsername,
      authorName: currentName || currentUsername,
      authorPhoto: currentPhoto || "",
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };

    // Optimistically update local state & persistence immediately
    setBlogs((prev) => {
      const updated = [newBlogItem, ...prev.filter((b) => b.id !== newBlogItem.id)];
      persistLocalBlogs(updated);
      return updated;
    });

    setTitle("");
    setContent("");
    setShowAddForm(false);

    try {
      await addDoc(collection(db, "blogs"), {
        title: newBlogItem.title,
        content: newBlogItem.content,
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
        console.warn("Saved blog locally:", errObj.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (bId: string) => {
    if (!currentUid) return;

    const targetBlog = blogs.find((b) => b.id === bId);
    if (!targetBlog) return;

    const currentLikedBy = Array.isArray(targetBlog.likedBy) ? targetBlog.likedBy : [];
    const isLiked = currentLikedBy.includes(currentUid);

    const nextLikedBy = isLiked
      ? currentLikedBy.filter((uid) => uid !== currentUid)
      : [...currentLikedBy, currentUid];

    const nextLikes = isLiked
      ? Math.max(0, (targetBlog.likes || 1) - 1)
      : (targetBlog.likes || 0) + 1;

    const nowAt = currentEpochMillis();
    const nextLikeMeta = { ...(targetBlog.likeMeta || {}) };
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
    setBlogs((prev) => {
      const updated = prev.map((b) =>
        b.id === bId ? { ...b, likes: nextLikes, likedBy: nextLikedBy, likeMeta: nextLikeMeta } : b
      );
      persistLocalBlogs(updated);
      return updated;
    });

    try {
      const blogRef = doc(db, "blogs", bId);
      await updateDoc(blogRef, {
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
            Personal Logs &amp; Blogs
          </h3>
          <p className="text-xs text-[var(--pastel-subtext)] mt-0.5">
            Little stories, thoughts &amp; reflections you want to share
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all portfolio-shadow cursor-pointer ${
            showAddForm
              ? "bg-[var(--pastel-card)] text-[var(--pastel-text)]"
              : "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] hover:opacity-90"
          }`}
        >
          {showAddForm ? "Cancel" : "+ Write Log"}
        </button>
      </div>

      {/* Add Log Form */}
      {showAddForm && (
        <form onSubmit={handleCreateBlog} className="p-5 sm:p-6 bg-[var(--pastel-card)] rounded-3xl portfolio-shadow space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. A peaceful afternoon with tea"
              className="w-full px-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] text-sm text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1.5">
              What is on your mind?
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your entry..."
              className="w-full px-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] text-sm text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[var(--pastel-primary)] hover:opacity-90 text-[var(--pastel-on-primary)] rounded-full text-xs font-bold transition-all portfolio-shadow disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Publishing..." : "Post Log"}
            </button>
          </div>
        </form>
      )}

      {/* Blog List */}
      <div className="space-y-4">
        {blogs.length === 0 ? (
          <div className="text-center py-10 text-xs text-[var(--pastel-subtext)] bg-[var(--pastel-card)] rounded-3xl portfolio-shadow">
            No blogs posted yet ~ write the first entry!
          </div>
        ) : (
          blogs.map((b) => {
            const isLiked = Array.isArray(b.likedBy) && b.likedBy.includes(currentUid);
            return (
              <div
                key={b.id}
                className="p-5 sm:p-6 bg-[var(--pastel-card)] rounded-3xl portfolio-shadow transition-all"
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <h4 className="text-sm sm:text-base font-bold text-[var(--pastel-text)]">
                    {b.title}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-[var(--pastel-tint)] text-[11px] text-[var(--pastel-text)] font-semibold">
                    {b.authorPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.authorPhoto} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-[var(--pastel-card)] text-[var(--pastel-accent-text)] font-bold text-[9px] flex items-center justify-center">
                        {b.authorName?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    )}
                    <span>@{b.authorUsername}</span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[var(--pastel-text)] leading-relaxed whitespace-pre-wrap my-2.5 opacity-90">
                  {b.content}
                </p>

                <div className="flex justify-end items-center pt-2">
                  <button
                    onClick={() => handleLike(b.id)}
                    title={isLiked ? "Click to unlike" : "Click to like"}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1 rounded-full transition-all cursor-pointer ${
                      isLiked
                        ? "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] shadow-2xs scale-[1.03]"
                        : "bg-[var(--pastel-tint)] text-[var(--pastel-accent-text)] hover:opacity-85"
                    }`}
                  >
                    <span>{isLiked ? "Liked" : "Like"}</span>
                    <span className="font-semibold">{b.likes || 0}</span>
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
