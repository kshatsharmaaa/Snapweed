"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { soundManager } from "@/lib/sound";

export type NotificationKind = "chat" | "blog" | "song" | "question" | "like";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  snippet: string;
  actorId: string;
  timestamp: number;
  roomId?: string;
  targetTab?: "questions" | "blogs" | "songs";
}

interface NotificationBellProps {
  currentUid: string;
  onNavigateTab?: (tab: "questions" | "blogs" | "songs") => void;
  onNavigateRoom?: (roomId: string) => void;
}

function parseTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts === "object") {
    if ("toMillis" in ts && typeof (ts as { toMillis: () => number }).toMillis === "function") {
      return (ts as { toMillis: () => number }).toMillis();
    }
    if ("seconds" in ts && typeof (ts as { seconds: number }).seconds === "number") {
      return (ts as { seconds: number }).seconds * 1000;
    }
  }
  return 0;
}

function formatRelativeTime(millis: number, nowMillis: number): string {
  if (!millis) return "Recently";
  if (!nowMillis) {
    return new Date(millis).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const diffSec = Math.max(0, Math.floor((nowMillis - millis) / 1000));
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function getStoredReadIds(uid: string): string[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const raw = localStorage.getItem(`snapweed_read_notifs_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function persistReadIds(uid: string, ids: string[]) {
  if (typeof window === "undefined" || !uid) return;
  try {
    localStorage.setItem(`snapweed_read_notifs_${uid}`, JSON.stringify(ids.slice(-150)));
  } catch {}
}

function extractLikeNotifications(
  docId: string,
  kindLabel: "log" | "track",
  targetTab: "blogs" | "songs",
  snippet: string,
  data: Record<string, unknown>,
  currentUid: string
): NotificationItem[] {
  if (data.authorId !== currentUid) return [];
  const likeMeta = data.likeMeta as
    | Record<string, { username?: string; name?: string; at?: unknown }>
    | undefined;
  if (!likeMeta || typeof likeMeta !== "object") return [];

  const likes: NotificationItem[] = [];
  Object.entries(likeMeta).forEach(([likerUid, info]) => {
    if (!likerUid || likerUid === currentUid || !info) return;
    const likedAt = parseTimestampMillis(info.at);
    likes.push({
      id: `notif_like_${targetTab}_${docId}_${likerUid}_${likedAt}`,
      kind: "like",
      title: `@${info.username || info.name || "friend"} liked your ${kindLabel}`,
      snippet,
      actorId: likerUid,
      timestamp: likedAt,
      targetTab,
    });
  });
  return likes;
}

export function NotificationBell({
  currentUid,
  onNavigateTab,
  onNavigateRoom,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "chats" | "posts" | "likes">("all");
  const [nowMillis, setNowMillis] = useState<number>(0);

  const [roomNotifs, setRoomNotifs] = useState<NotificationItem[]>([]);
  const [blogNotifs, setBlogNotifs] = useState<NotificationItem[]>([]);
  const [songNotifs, setSongNotifs] = useState<NotificationItem[]>([]);
  const [questionNotifs, setQuestionNotifs] = useState<NotificationItem[]>([]);

  const [readIds, setReadIds] = useState<string[]>(() => getStoredReadIds(currentUid));

  const containerRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);

  // Keep relative clock synced
  useEffect(() => {
    const initTimer = setTimeout(() => setNowMillis(Date.now()), 0);
    const interval = setInterval(() => setNowMillis(Date.now()), 30000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // 1. Listen to Chat Messages in user's active rooms & all community posts
  useEffect(() => {
    const unsubRooms = onSnapshot(
      query(collection(db, "rooms")),
      (snap) => {
        const list: NotificationItem[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.status === "terminated") return;
          if (!Array.isArray(data.participants) || !data.participants.includes(currentUid)) return;

          const lastMsgTs = parseTimestampMillis(data.lastMessageAt);
          if (lastMsgTs > 0 && data.lastMessageText) {
            list.push({
              id: `notif_msg_${d.id}_${lastMsgTs}`,
              kind: "chat",
              title: `Chat in Room #${data.securityCode || "Room"}`,
              snippet: `${data.lastMessageSender || "Member"}: "${data.lastMessageText}"`,
              actorId: data.lastMessageSenderId || "",
              timestamp: lastMsgTs,
              roomId: d.id,
            });
          }
        });
        setRoomNotifs(list);
      },
      () => {}
    );

    // 2. Listen to Blogs & Likes on user's blogs
    const unsubBlogs = onSnapshot(
      query(collection(db, "blogs")),
      (snap) => {
        const list: NotificationItem[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          const blogTitle = data.title || "Shared a personal log";
          list.push({
            id: `notif_blog_${d.id}`,
            kind: "blog",
            title: `New blog from @${data.authorUsername || "friend"}`,
            snippet: blogTitle,
            actorId: data.authorId || "",
            timestamp: parseTimestampMillis(data.createdAt),
            targetTab: "blogs",
          });

          list.push(
            ...extractLikeNotifications(d.id, "log", "blogs", blogTitle, data, currentUid)
          );
        });
        setBlogNotifs(list);
      },
      () => {}
    );

    // 3. Listen to Song Recommendations & Likes on user's tracks
    const unsubSongs = onSnapshot(
      query(collection(db, "song_recommendations")),
      (snap) => {
        const list: NotificationItem[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          const songSnippet = `${data.title || "Track"} — ${data.artist || "Artist"}`;
          list.push({
            id: `notif_song_${d.id}`,
            kind: "song",
            title: `New track from @${data.authorUsername || "friend"}`,
            snippet: songSnippet,
            actorId: data.authorId || "",
            timestamp: parseTimestampMillis(data.createdAt),
            targetTab: "songs",
          });

          list.push(
            ...extractLikeNotifications(d.id, "track", "songs", songSnippet, data, currentUid)
          );
        });
        setSongNotifs(list);
      },
      () => {}
    );

    // 4. Listen to Questions & Replies
    const unsubQuestions = onSnapshot(
      query(collection(db, "questions")),
      (snap) => {
        const list: NotificationItem[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          const qTs = parseTimestampMillis(data.createdAt);
          list.push({
            id: `notif_q_${d.id}`,
            kind: "question",
            title: `New question from @${data.authorUsername || "friend"}`,
            snippet: data.question || "Asked a question",
            actorId: data.authorId || "",
            timestamp: qTs,
            targetTab: "questions",
          });

          if (Array.isArray(data.answers) && data.answers.length > 0) {
            const latestAns = data.answers[data.answers.length - 1];
            const ansTs = parseTimestampMillis(data.updatedAt) || qTs + 1000;
            list.push({
              id: `notif_ans_${d.id}_${latestAns.id || data.answers.length}`,
              kind: "question",
              title: `Reply from @${latestAns.authorUsername || "friend"}`,
              snippet: `"${latestAns.text}"`,
              actorId: latestAns.authorId || "",
              timestamp: ansTs,
              targetTab: "questions",
            });
          }
        });
        setQuestionNotifs(list);
      },
      () => {}
    );

    return () => {
      unsubRooms();
      unsubBlogs();
      unsubSongs();
      unsubQuestions();
    };
  }, [currentUid]);

  const allNotifications = useMemo(() => {
    const combined = [...roomNotifs, ...blogNotifs, ...songNotifs, ...questionNotifs];
    combined.sort((a, b) => b.timestamp - a.timestamp);
    return combined.slice(0, 30);
  }, [roomNotifs, blogNotifs, songNotifs, questionNotifs]);

  // Gently chime when a genuinely new unread item from someone else arrives
  useEffect(() => {
    if (allNotifications.length === 0) return;
    if (knownIdsRef.current === null) {
      knownIdsRef.current = new Set(allNotifications.map((n) => n.id));
      return;
    }

    let hasNewFromOther = false;
    allNotifications.forEach((n) => {
      if (!knownIdsRef.current!.has(n.id)) {
        knownIdsRef.current!.add(n.id);
        if (n.actorId !== currentUid && !readIds.includes(n.id)) {
          hasNewFromOther = true;
        }
      }
    });

    if (hasNewFromOther) {
      soundManager.play("pop");
    }
  }, [allNotifications, currentUid, readIds]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter(
      (n) => n.actorId !== currentUid && !readIds.includes(n.id)
    ).length;
  }, [allNotifications, currentUid, readIds]);

  const filteredNotifications = useMemo(() => {
    if (filter === "chats") return allNotifications.filter((n) => n.kind === "chat");
    if (filter === "posts") {
      return allNotifications.filter(
        (n) => n.kind === "blog" || n.kind === "song" || n.kind === "question"
      );
    }
    if (filter === "likes") return allNotifications.filter((n) => n.kind === "like");
    return allNotifications;
  }, [allNotifications, filter]);

  const markAsRead = (id: string) => {
    if (readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    persistReadIds(currentUid, next);
  };

  const handleMarkAllRead = () => {
    const next = Array.from(new Set([...readIds, ...allNotifications.map((n) => n.id)]));
    setReadIds(next);
    persistReadIds(currentUid, next);
  };

  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    setIsOpen(false);
    if (item.roomId && onNavigateRoom) {
      onNavigateRoom(item.roomId);
    } else if (item.targetTab && onNavigateTab) {
      onNavigateTab(item.targetTab);
    }
  };

  const getBadgeLabel = (kind: NotificationKind) => {
    switch (kind) {
      case "chat":
        return "Chat";
      case "blog":
        return "Blog";
      case "song":
        return "Track";
      case "question":
        return "Q&A";
      case "like":
        return "Like";
    }
  };

  return (
    <div className="relative" ref={containerRef} style={{ colorScheme: "light" }}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-full border transition-all shadow-2xs hover:opacity-90 cursor-pointer flex items-center justify-center"
        style={{
          backgroundColor: isOpen ? "var(--pastel-border)" : "var(--pastel-tint)",
          borderColor: "var(--pastel-border)",
          color: "var(--pastel-text)",
        }}
        title="Notifications"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-xs"
            style={{ backgroundColor: "var(--pastel-primary)" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-3xl border shadow-xl z-50 overflow-hidden"
          style={{ borderColor: "var(--pastel-border)", colorScheme: "light" }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{
              backgroundColor: "var(--pastel-tint)",
              borderColor: "var(--pastel-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-black" style={{ color: "var(--pastel-text)" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: "var(--pastel-primary)" }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            {allNotifications.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold hover:underline cursor-pointer"
                style={{ color: "var(--pastel-primary)" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div
            className="px-3 py-2 border-b flex gap-1.5 bg-white"
            style={{ borderColor: "var(--pastel-border)" }}
          >
            {(["all", "chats", "posts", "likes"] as const).map((tabKey) => {
              const active = filter === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setFilter(tabKey)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer"
                  style={{
                    backgroundColor: active ? "var(--pastel-primary)" : "var(--pastel-tint)",
                    color: active ? "#ffffff" : "var(--pastel-subtext)",
                  }}
                >
                  {tabKey}
                </button>
              );
            })}
          </div>

          {/* Feed List */}
          <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: "var(--pastel-border)" }}>
            {filteredNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <p className="text-xs font-bold mb-1" style={{ color: "var(--pastel-text)" }}>
                  All caught up
                </p>
                <p className="text-[11px]" style={{ color: "var(--pastel-subtext)" }}>
                  Updates about chats, blogs, tracks, and questions will appear here.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isUnread = item.actorId !== currentUid && !readIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors flex items-start gap-2.5 cursor-pointer"
                    style={{
                      backgroundColor: isUnread ? "var(--pastel-tint)" : "#ffffff",
                      borderColor: "var(--pastel-border)",
                    }}
                  >
                    <span
                      className="mt-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 border"
                      style={{
                        backgroundColor: "#ffffff",
                        borderColor: "var(--pastel-border)",
                        color: "var(--pastel-primary)",
                      }}
                    >
                      {getBadgeLabel(item.kind)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold truncate" style={{ color: "var(--pastel-text)" }}>
                          {item.title}
                        </p>
                        <span className="text-[10px] shrink-0" style={{ color: "var(--pastel-subtext)" }}>
                          {formatRelativeTime(item.timestamp, nowMillis)}
                        </span>
                      </div>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--pastel-subtext)" }}>
                        {item.snippet}
                      </p>
                    </div>

                    {isUnread && (
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: "var(--pastel-primary)" }}
                        title="Unread"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

