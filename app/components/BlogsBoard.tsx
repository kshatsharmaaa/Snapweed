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
    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[var(--pastel-border)] shadow-xs transition-colors" style={{ colorScheme: "light" }}>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="text-lg font-black text-[var(--pastel-text)] flex items-center gap-2">
            Personal Logs &amp; Blogs
          </h3>
          <p className="text-xs text-[var(--pastel-subtext)]">
            little stories, thoughts &amp; reflections you want to share here
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3.5 py-1.5 bg-[var(--pastel-tint)] hover:bg-[var(--pastel-border)] text-[var(--pastel-text)] rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          {showAddForm ? "Cancel" : "+ Write Log"}
        </button>
      </div>

      {/* Add Log Form */}
      {showAddForm && (
        <form onSubmit={handleCreateBlog} className="mb-6 p-4 bg-[var(--pastel-tint)]/40 rounded-2xl border border-[var(--pastel-border)] space-y-3">
          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. A peaceful afternoon with tea"
              className="w-full px-3.5 py-2 rounded-xl border border-[var(--pastel-border)] bg-white text-sm text-[var(--pastel-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1">
              What is on your mind?
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts gently..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--pastel-border)] bg-white text-sm text-[var(--pastel-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)]"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[var(--pastel-primary)] hover:opacity-90 text-white rounded-2xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Publishing..." : "Post Log"}
            </button>
          </div>
        </form>
      )}

      {/* Blog List */}
      <div className="space-y-4">
        {blogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--pastel-subtext)] bg-[var(--pastel-tint)]/25 rounded-2xl border border-[var(--pastel-border)]/60">
            No blogs posted yet ~ write the first entry!
          </div>
        ) : (
          blogs.map((b) => {
            const isLiked = Array.isArray(b.likedBy) && b.likedBy.includes(currentUid);
            return (
              <div
                key={b.id}
                className="p-4 bg-[var(--pastel-tint)]/20 rounded-2xl border border-[var(--pastel-border)]/70 hover:border-[var(--pastel-border)] transition-colors"
              >
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <h4 className="text-sm font-bold text-[var(--pastel-text)]">
                    {b.title}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-[var(--pastel-subtext)] font-medium">
                    {b.authorPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.authorPhoto} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-[var(--pastel-tint)] text-[var(--pastel-primary)] font-bold text-[9px] flex items-center justify-center border border-[var(--pastel-border)]">
                        {b.authorName?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    )}
                    <span>@{b.authorUsername}</span>
                  </div>
                </div>

                <p className="text-xs text-[var(--pastel-text)] leading-relaxed whitespace-pre-wrap my-2">
                  {b.content}
                </p>

                <div className="flex justify-end items-center pt-2 border-t border-[var(--pastel-border)]/50">
                  <button
                    onClick={() => handleLike(b.id)}
                    title={isLiked ? "Click to unlike" : "Click to like"}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border shadow-2xs transition-all cursor-pointer ${
                      isLiked
                        ? "bg-[var(--pastel-primary)] text-white border-[var(--pastel-primary)] scale-102"
                        : "bg-white text-[var(--pastel-primary)] border-[var(--pastel-border)] hover:bg-[var(--pastel-tint)]"
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
