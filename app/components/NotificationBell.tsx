"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
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
  activeRoomId?: string;
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

const activeNativeNotifications = new Set<Notification>();
const PROMPT_DISMISS_KEY = "snapweed_desktop_prompt_dismissed";
let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function getNotificationTargetUrl(item: NotificationItem): string {
  if (item.roomId) return `/room/${item.roomId}`;
  if (item.targetTab) return `/dashboard?tab=${item.targetTab}`;
  return "/dashboard";
}

function registerNotificationSw(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register("/sw.js")
      .catch(() => null);
  }
  return swRegistrationPromise;
}

async function showDesktopNotification(
  title: string,
  body: string,
  tag: string,
  targetUrl: string,
  item?: NotificationItem,
  onNativeClick?: () => void
) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  // Prefer Service Worker notifications so Chromium/Brave displays banners reliably
  // when tabs are throttled and focuses the window smoothly on click.
  if ("serviceWorker" in navigator) {
    try {
      const reg = (await navigator.serviceWorker.getRegistration()) || (await registerNotificationSw());
      if (reg && reg.active) {
        await reg.showNotification(title, {
          body,
          tag,
          icon: "/favicon.ico",
          data: { url: targetUrl, item },
        });
        return;
      }
    } catch {
      // Fall back to direct Notification constructor below
    }
  }

  try {
    const nativeNotif = new Notification(title, {
      body,
      tag,
      icon: "/favicon.ico",
    });
    activeNativeNotifications.add(nativeNotif);
    nativeNotif.onclose = () => activeNativeNotifications.delete(nativeNotif);
    nativeNotif.onerror = () => activeNativeNotifications.delete(nativeNotif);
    nativeNotif.onclick = () => {
      window.focus();
      onNativeClick?.();
      nativeNotif.close();
    };
  } catch {
    // Ignore browser Notification restrictions
  }
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function getNotificationBadgeLabel(kind: NotificationKind) {
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
}

/** Single Gmail-style floating toast card with a self-contained 6-second auto-dismiss timer. */
function FloatingToastCard({
  toast,
  onSelect,
  onDismiss,
}: {
  toast: NotificationItem;
  onSelect: (item: NotificationItem) => void;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl border shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-3.5 animate-toast-in flex items-start gap-2.5 cursor-pointer hover:opacity-95 transition-opacity"
      style={{ borderColor: "var(--pastel-border)" }}
      onClick={() => onSelect(toast)}
      role="status"
    >
      <span
        className="mt-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 border"
        style={{
          backgroundColor: "var(--pastel-tint)",
          borderColor: "var(--pastel-border)",
          color: "var(--pastel-primary)",
        }}
      >
        {getNotificationBadgeLabel(toast.kind)}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black truncate" style={{ color: "var(--pastel-text)" }}>
            {toast.title}
          </p>
          <span className="text-[10px] font-semibold shrink-0" style={{ color: "var(--pastel-primary)" }}>
            Just now
          </span>
        </div>
        <p className="text-[11px] line-clamp-2 mt-0.5" style={{ color: "var(--pastel-subtext)" }}>
          {toast.snippet}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="p-1 rounded-full hover:bg-stone-100 shrink-0 cursor-pointer"
        style={{ color: "var(--pastel-subtext)" }}
        aria-label="Dismiss notification"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

export function NotificationBell({
  currentUid,
  activeRoomId,
  onNavigateTab,
  onNavigateRoom,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "posts" | "likes">("all");
  const [nowMillis, setNowMillis] = useState<number>(0);
  const [portalMounted, setPortalMounted] = useState(false);
  const [desktopPerm, setDesktopPerm] = useState<"default" | "granted" | "denied" | "unsupported">("unsupported");
  const [promptDismissed, setPromptDismissed] = useState(true);

  const [blogNotifs, setBlogNotifs] = useState<NotificationItem[]>([]);
  const [songNotifs, setSongNotifs] = useState<NotificationItem[]>([]);
  const [questionNotifs, setQuestionNotifs] = useState<NotificationItem[]>([]);
  const [floatingToasts, setFloatingToasts] = useState<NotificationItem[]>([]);

  const [readIds, setReadIds] = useState<string[]>(() => getStoredReadIds(currentUid));

  const containerRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const loadedStreamsRef = useRef({
    rooms: false,
    blogs: false,
    songs: false,
    questions: false,
  });
  const readIdsRef = useRef<string[]>(readIds);
  const baseTitleRef = useRef<string>("");
  const hiddenAlertCountRef = useRef<number>(0);

  useEffect(() => {
    readIdsRef.current = readIds;
  }, [readIds]);

  // Sync relative clock, client portal flag, Service Worker, and Desktop Notification permission status
  useEffect(() => {
    let permStatus: PermissionStatus | null = null;
    const handlePermChange = () => {
      if (typeof window !== "undefined" && "Notification" in window) {
        setDesktopPerm(Notification.permission);
      }
    };

    const initTimer = setTimeout(() => {
      setPortalMounted(true);
      setNowMillis(Date.now());
      baseTitleRef.current = document.title.replace(/^\(\d+\)\s*/, "");

      if (typeof window !== "undefined" && "Notification" in window) {
        const perm = Notification.permission;
        setDesktopPerm(perm);
        if (perm === "granted") {
          void registerNotificationSw();
        }
        try {
          setPromptDismissed(sessionStorage.getItem(PROMPT_DISMISS_KEY) === "1");
        } catch {
          setPromptDismissed(false);
        }
        if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
          navigator.permissions
            .query({ name: "notifications" as PermissionName })
            .then((status) => {
              permStatus = status;
              status.addEventListener("change", handlePermChange);
            })
            .catch(() => {});
        }
      } else {
        setDesktopPerm("unsupported");
      }
    }, 0);

    const resetHiddenTitle = () => {
      if (!document.hidden && document.hasFocus() && hiddenAlertCountRef.current > 0) {
        hiddenAlertCountRef.current = 0;
        if (baseTitleRef.current) {
          document.title = baseTitleRef.current;
        }
      }
    };

    window.addEventListener("focus", resetHiddenTitle);
    document.addEventListener("visibilitychange", resetHiddenTitle);
    const interval = setInterval(() => setNowMillis(Date.now()), 30000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
      window.removeEventListener("focus", resetHiddenTitle);
      document.removeEventListener("visibilitychange", resetHiddenTitle);
      if (permStatus) {
        permStatus.removeEventListener("change", handlePermChange);
      }
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

  const markAsRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        persistReadIds(currentUid, next);
        return next;
      });
    },
    [currentUid]
  );

  const dismissToast = useCallback((id: string) => {
    setFloatingToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleNotificationClick = useCallback(
    (item: NotificationItem) => {
      markAsRead(item.id);
      dismissToast(item.id);
      setIsOpen(false);
      if (item.roomId && onNavigateRoom) {
        onNavigateRoom(item.roomId);
      } else if (item.targetTab && onNavigateTab) {
        onNavigateTab(item.targetTab);
      }
    },
    [markAsRead, dismissToast, onNavigateRoom, onNavigateTab]
  );

  const onNotificationClickRef = useRef(handleNotificationClick);
  useEffect(() => {
    onNotificationClickRef.current = handleNotificationClick;
  }, [handleNotificationClick]);

  // Route clicks arriving from Service Worker desktop notifications cleanly within the SPA
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SNAPWEED_NOTIFICATION_CLICK" && event.data.item) {
        onNotificationClickRef.current(event.data.item as NotificationItem);
      }
    };
    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, []);

  const emitLiveNotifications = useCallback(
    (streamKey: "rooms" | "blogs" | "songs" | "questions", items: NotificationItem[]) => {
      if (!loadedStreamsRef.current[streamKey]) {
        items.forEach((item) => seenIdsRef.current.add(item.id));
        loadedStreamsRef.current[streamKey] = true;
        return;
      }

      const freshFromOthers: NotificationItem[] = [];
      items.forEach((item) => {
        if (!seenIdsRef.current.has(item.id)) {
          seenIdsRef.current.add(item.id);
          if (item.actorId !== currentUid && !readIdsRef.current.includes(item.id)) {
            freshFromOthers.push(item);
          }
        }
      });

      if (freshFromOthers.length === 0) return;

      const isTabHiddenOrUnfocused =
        typeof document !== "undefined" && (document.hidden || !document.hasFocus());

      let shouldChime = false;

      freshFromOthers.forEach((item) => {
        const isCurrentChatRoom = Boolean(activeRoomId && item.roomId === activeRoomId);

        // 1. OS / Browser Desktop Notification when user is on another window, another app, or background tab
        if (
          isTabHiddenOrUnfocused &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          shouldChime = true;
          hiddenAlertCountRef.current += 1;
          if (baseTitleRef.current) {
            document.title = `(${hiddenAlertCountRef.current}) ${baseTitleRef.current}`;
          }
          void showDesktopNotification(
            item.title,
            item.snippet,
            item.id,
            getNotificationTargetUrl(item),
            item,
            () => onNotificationClickRef.current(item)
          );
        }

        // 2. Floating in-app Gmail-style Toast when viewing Dashboard/another room, or when tab/window was unfocused
        if (!isCurrentChatRoom || isTabHiddenOrUnfocused) {
          shouldChime = true;
          setFloatingToasts((prev) => {
            if (prev.some((t) => t.id === item.id)) return prev;
            return [item, ...prev].slice(0, 3);
          });
        }
      });

      if (shouldChime) {
        soundManager.play("pop");
      }
    },
    [currentUid, activeRoomId]
  );

  // Subscribe to Firestore streams (Rooms chat messages trigger floating/OS alerts only; community posts populate Bell drawer + floating/OS alerts)
  useEffect(() => {
    if (!currentUid) return;

    const unsubRooms = onSnapshot(
      query(collection(db, "rooms"), where("participants", "array-contains", currentUid)),
      (snap) => {
        const list: NotificationItem[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.status === "terminated") return;

          const lastMsgTs = parseTimestampMillis(data.lastMessageAt);
          if (lastMsgTs > 0 && data.lastMessageText) {
            const textPreview = String(data.lastMessageText);
            list.push({
              id: `notif_msg_${d.id}_${lastMsgTs}_${textPreview.slice(0, 12)}`,
              kind: "chat",
              title: `Chat in Room #${data.securityCode || "Room"}`,
              snippet: `${data.lastMessageSender || "Member"}: "${textPreview}"`,
              actorId: data.lastMessageSenderId || "",
              timestamp: lastMsgTs,
              roomId: d.id,
            });
          }
        });
        emitLiveNotifications("rooms", list);
      },
      () => {}
    );

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
        emitLiveNotifications("blogs", list);
      },
      () => {}
    );

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
        emitLiveNotifications("songs", list);
      },
      () => {}
    );

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
        emitLiveNotifications("questions", list);
      },
      () => {}
    );

    return () => {
      unsubRooms();
      unsubBlogs();
      unsubSongs();
      unsubQuestions();
    };
  }, [currentUid, emitLiveNotifications]);

  const allNotifications = useMemo(() => {
    const combined = [...blogNotifs, ...songNotifs, ...questionNotifs];
    combined.sort((a, b) => b.timestamp - a.timestamp);
    return combined.slice(0, 30);
  }, [blogNotifs, songNotifs, questionNotifs]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter(
      (n) => n.actorId !== currentUid && !readIds.includes(n.id)
    ).length;
  }, [allNotifications, currentUid, readIds]);

  const filteredNotifications = useMemo(() => {
    if (filter === "posts") {
      return allNotifications.filter(
        (n) => n.kind === "blog" || n.kind === "song" || n.kind === "question"
      );
    }
    if (filter === "likes") return allNotifications.filter((n) => n.kind === "like");
    return allNotifications;
  }, [allNotifications, filter]);

  const handleMarkAllRead = () => {
    const next = Array.from(new Set([...readIds, ...allNotifications.map((n) => n.id)]));
    setReadIds(next);
    persistReadIds(currentUid, next);
  };

  const handleDismissPrompt = () => {
    setPromptDismissed(true);
    try {
      sessionStorage.setItem(PROMPT_DISMISS_KEY, "1");
    } catch {}
  };

  const handleRequestDesktopPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const result = await Notification.requestPermission();
      setDesktopPerm(result);
      if (result === "granted") {
        setPromptDismissed(true);
        await registerNotificationSw();
        await showDesktopNotification(
          "Snapweed Desktop Alerts Enabled",
          "Live chat messages and community updates will now float outside your browser window.",
          "snapweed_test_enabled",
          "/dashboard"
        );
      }
    } catch {
      // Ignore permission rejection
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
            className="px-4 py-3 border-b flex items-center justify-between gap-2"
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

            <div className="flex items-center gap-2.5">
              {desktopPerm === "default" && (
                <button
                  type="button"
                  onClick={handleRequestDesktopPermission}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border hover:opacity-85 cursor-pointer"
                  style={{
                    borderColor: "var(--pastel-border)",
                    color: "var(--pastel-text)",
                  }}
                  title="Get browser popups even when tab is in background"
                >
                  Enable desktop alerts
                </button>
              )}
              {desktopPerm === "granted" && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border"
                  style={{
                    borderColor: "var(--pastel-border)",
                    color: "var(--pastel-primary)",
                  }}
                >
                  Desktop on
                </span>
              )}
              {desktopPerm === "denied" && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border"
                  style={{
                    borderColor: "var(--pastel-border)",
                    color: "var(--pastel-subtext)",
                  }}
                  title="Allow notifications for this site in your browser settings"
                >
                  Blocked
                </span>
              )}
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
          </div>

          {desktopPerm === "denied" && (
            <div
              className="px-4 py-2 border-b text-[11px] bg-white"
              style={{ borderColor: "var(--pastel-border)", color: "var(--pastel-subtext)" }}
            >
              Browser notifications are blocked. Allow notifications for this site in browser settings to receive outside-window popups.
            </div>
          )}

          {/* Filter Tabs */}
          <div
            className="px-3 py-2 border-b flex gap-1.5 bg-white"
            style={{ borderColor: "var(--pastel-border)" }}
          >
            {(["all", "posts", "likes"] as const).map((tabKey) => {
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
                  Updates about blogs, tracks, and questions will appear here.
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
                      {getNotificationBadgeLabel(item.kind)}
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

      {/* Floating Gmail-style Live Toast Stack & Desktop Alert Opt-In rendered via Portal directly on document.body */}
      {portalMounted &&
        (floatingToasts.length > 0 || (desktopPerm === "default" && !promptDismissed)) &&
        createPortal(
          <div
            className="fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-2.5 w-80 sm:w-96 pointer-events-none"
            style={{ colorScheme: "light" }}
            aria-live="polite"
          >
            {desktopPerm === "default" && !promptDismissed && (
              <div
                className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl border shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-3.5 animate-toast-in"
                style={{ borderColor: "var(--pastel-border)" }}
                role="region"
                aria-label="Enable desktop alerts"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black" style={{ color: "var(--pastel-text)" }}>
                      Enable outside-window alerts
                    </p>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--pastel-subtext)" }}>
                      See floating chat and live update notifications even when you are in another window or app.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDismissPrompt}
                    className="p-1 rounded-full hover:bg-stone-100 shrink-0 cursor-pointer"
                    style={{ color: "var(--pastel-subtext)" }}
                    aria-label="Dismiss alert prompt"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={handleRequestDesktopPermission}
                    className="px-3 py-1 rounded-xl text-[11px] font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: "var(--pastel-primary)" }}
                  >
                    Enable alerts
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissPrompt}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-semibold cursor-pointer hover:bg-stone-100 transition-colors"
                    style={{ color: "var(--pastel-subtext)" }}
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}

            {floatingToasts.map((toast) => (
              <FloatingToastCard
                key={`toast_${toast.id}`}
                toast={toast}
                onSelect={handleNotificationClick}
                onDismiss={dismissToast}
              />
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
