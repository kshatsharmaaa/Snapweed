"use client";

import { useEffect, useState, useRef, use, useCallback, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useRoomWebSocket, WebSocketMessage } from "@/lib/useRoomWebSocket";
import {
  applyPastelTheme,
  getStoredPastelTheme,
  getStoredThemeMode,
  DEFAULT_THEME_ID,
} from "@/lib/pastel-themes";
import { NotificationBell } from "@/app/components/NotificationBell";
import { UserProfileViewModal } from "@/app/components/UserProfileViewModal";
import { ChatEmojiPicker } from "@/app/components/ChatEmojiPicker";
import { ChatGifPicker, SelectedGif } from "@/app/components/ChatGifPicker";
import { ThemeModeToggle } from "@/app/components/ThemeModeToggle";
import { UserAvatar } from "@/app/components/UserAvatar";
import { prepareMediaForChat, PreparedMedia } from "@/lib/chat-media";
import { useUserPhotoDirectory, resolveAuthorPhoto } from "@/lib/user-avatars";

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderUsername?: string;
  senderPhoto?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
  createdAt: unknown;
  wsId?: string;
}

function currentEpochMillis(): number {
  return Date.now();
}

function generateClientMsgId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

interface RoomData {
  securityCode: string;
  createdBy: string;
  createdByName?: string;
  status: string;
  participants: string[];
  roomPassword?: string;
}

function formatTime(createdAt: unknown) {
  if (!createdAt) return "";
  try {
    let date: Date;
    if (typeof createdAt === "number") {
      date = new Date(createdAt);
    } else if (
      typeof createdAt === "object" &&
      createdAt !== null &&
      "toDate" in createdAt &&
      typeof (createdAt as { toDate: () => Date }).toDate === "function"
    ) {
      date = (createdAt as { toDate: () => Date }).toDate();
    } else if (
      typeof createdAt === "object" &&
      createdAt !== null &&
      "seconds" in createdAt &&
      typeof (createdAt as { seconds: number }).seconds === "number"
    ) {
      date = new Date((createdAt as { seconds: number }).seconds * 1000);
    } else if (typeof createdAt === "string") {
      date = new Date(createdAt);
    } else {
      return "";
    }
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

const EMOJI_MATCH_REGEX =
  /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|(?:\p{Extended_Pictographic}(?:\uFE0F|\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})?)*))/gu;

function renderChatMessageText(text: string): ReactNode {
  const matches = Array.from(text.matchAll(EMOJI_MATCH_REGEX));
  if (matches.length === 0) {
    return <div className="break-words">{text}</div>;
  }

  const stripped = text.replace(EMOJI_MATCH_REGEX, "").trim();
  if (stripped.length === 0 && matches.length <= 6) {
    const sizeClass =
      matches.length === 1
        ? "text-[44px] leading-tight py-1"
        : matches.length <= 3
        ? "text-[34px] leading-tight py-0.5 tracking-wide"
        : "text-[28px] leading-snug tracking-wide";

    return (
      <div
        className={`break-words ${sizeClass}`}
        style={{
          fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
        }}
      >
        {text}
      </div>
    );
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, idx) => {
    const start = m.index ?? 0;
    const emojiStr = m[0];
    if (start > cursor) {
      parts.push(<span key={`t_${idx}_${cursor}`}>{text.slice(cursor, start)}</span>);
    }
    parts.push(
      <span
        key={`e_${idx}_${start}`}
        className="text-[22px] leading-none inline-block align-[-3px] mx-[1px]"
        style={{
          fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
        }}
      >
        {emojiStr}
      </span>
    );
    cursor = start + emojiStr.length;
  });

  if (cursor < text.length) {
    parts.push(<span key={`t_end_${cursor}`}>{text.slice(cursor)}</span>);
  }

  return <div className="break-words">{parts}</div>;
}

export default function Room({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.id;
  
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("Friend");
  const [userUsername, setUserUsername] = useState("user");
  const [userPhoto, setUserPhoto] = useState("");
  const [room, setRoom] = useState<RoomData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Room Password Gate
  const [isPasswordUnlocked, setIsPasswordUnlocked] = useState(false);
  const [roomPasswordInput, setRoomPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Profile viewing, online members menu, media upload, and image zoom
  const [viewingUser, setViewingUser] = useState<{
    uid: string;
    name?: string;
    username?: string;
    photo?: string;
  } | null>(null);
  const [showOnlineList, setShowOnlineList] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PreparedMedia | null>(null);
  const [preparingMedia, setPreparingMedia] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);
  const photoDir = useUserPhotoDirectory();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // 1. Authenticate user and fetch profile before mounting room socket
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const storedTheme = getStoredPastelTheme();
        const storedMode = getStoredThemeMode();
        let resolvedName = currentUser.email?.split("@")[0] || "Friend";

        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (!active) return;
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.name) resolvedName = data.name;
            if (data.username) setUserUsername(data.username);
            if (data.photoURL) setUserPhoto(data.photoURL);
            const prefMode =
              typeof data.darkMode === "boolean"
                ? data.darkMode
                  ? "dark"
                  : "light"
                : storedMode;
            applyPastelTheme(data.themeColor || storedTheme || DEFAULT_THEME_ID, prefMode);
          } else {
            applyPastelTheme(storedTheme || DEFAULT_THEME_ID, storedMode);
          }
        } catch {
          applyPastelTheme(storedTheme || DEFAULT_THEME_ID, storedMode);
        }

        if (!active) return;
        setUserName(resolvedName);
        setUser(currentUser);
      } else {
        router.push("/login");
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  // 2. Subscribe to Room document
  useEffect(() => {
    if (!user || !roomId) return;

    const roomRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (!docSnap.exists()) {
        setError("This room does not exist.");
        setLoading(false);
        return;
      }

      const data = docSnap.data() as RoomData;
      
      if (data.status === "terminated") {
        setError("This chat room has ended.");
        setTimeout(() => router.push("/dashboard"), 2500);
        return;
      }

      if (!data.participants?.includes(user.uid)) {
        setError("You are not a participant in this room.");
        setTimeout(() => router.push("/dashboard"), 2500);
        return;
      }

      // Creator bypasses password check
      if (data.createdBy === user.uid || !data.roomPassword) {
        setIsPasswordUnlocked(true);
      }

      setRoom(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to load room details.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, user, router]);

  // Handle incoming WebSocket messages with deduplication
  const handleWebSocketMessage = useCallback((wsMsg: WebSocketMessage) => {
    setMessages((prev) => {
      const nowMs = currentEpochMillis();
      const exists = prev.some(
        (m) =>
          m.id === wsMsg.id ||
          m.wsId === wsMsg.id ||
          (m.senderId === wsMsg.senderId &&
            m.text === wsMsg.text &&
            (m.mediaName || "") === (wsMsg.mediaName || "") &&
            Math.abs((typeof m.createdAt === "number" ? m.createdAt : nowMs) - wsMsg.createdAt) < 3000)
      );

      if (exists) return prev;

      const newMsg: Message = {
        id: wsMsg.id,
        wsId: wsMsg.id,
        text: wsMsg.text,
        senderId: wsMsg.senderId,
        senderName: wsMsg.senderName,
        senderUsername: wsMsg.senderEmoji,
        senderPhoto: wsMsg.senderPhoto,
        mediaUrl: wsMsg.mediaUrl,
        mediaType: wsMsg.mediaType,
        mediaName: wsMsg.mediaName,
        createdAt: wsMsg.createdAt,
      };

      return [...prev, newMsg];
    });

    setTimeout(() => scrollToBottom(true), 50);
  }, [scrollToBottom]);

  // Handle room terminated over WebSocket
  const handleRoomTerminated = useCallback(() => {
    setError("This chat room has been closed.");
    setTimeout(() => router.push("/dashboard"), 2000);
  }, [router]);

  // WebSocket Hook for real-time messaging, presence, and typing status (only active once room is verified & unlocked)
  const {
    connectionStatus,
    onlineUsers,
    typingUsers,
    sendMessage: sendWsMessage,
    sendTyping,
    terminateRoom: sendWsTerminate,
    reconnect
  } = useRoomWebSocket({
    roomId,
    userId: user?.uid,
    userName,
    enabled: Boolean(user?.uid && room && isPasswordUnlocked && !error),
    onMessageReceived: handleWebSocketMessage,
    onRoomTerminated: handleRoomTerminated,
  });

  // 3. Subscribe to Firestore Messages collection
  useEffect(() => {
    if (!roomId) return;

    const messagesRef = collection(db, "rooms", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbMsgs = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          wsId: data.wsId,
          text: data.text || "",
          senderId: data.senderId,
          senderName: data.senderName,
          senderUsername: data.senderUsername,
          senderPhoto: data.senderPhoto,
          mediaUrl: data.mediaUrl || "",
          mediaType: data.mediaType || "",
          mediaName: data.mediaName || "",
          createdAt: data.createdAt
        };
      }) as Message[];
      
      setMessages((prev) => {
        const dbIds = new Set(dbMsgs.map(m => m.id));
        const dbWsIds = new Set(dbMsgs.filter(m => m.wsId).map(m => m.wsId));
        const unpersistedLocal = prev.filter(m => !dbIds.has(m.id) && (!m.wsId || !dbWsIds.has(m.wsId)));
        return [...dbMsgs, ...unpersistedLocal];
      });

      setTimeout(() => scrollToBottom(false), 80);
    });

    return () => unsubscribe();
  }, [roomId, scrollToBottom]);

  const handleUnlockRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!room?.roomPassword) {
      setIsPasswordUnlocked(true);
      return;
    }
    if (roomPasswordInput === room.roomPassword) {
      setIsPasswordUnlocked(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect room password.");
    }
  };

  const handleMediaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setMediaError("");
    setPreparingMedia(true);
    try {
      const prepared = await prepareMediaForChat(file);
      setPendingMedia(prepared);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setMediaError(errObj.message || "Could not prepare media file.");
    } finally {
      setPreparingMedia(false);
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    const input = messageInputRef.current;
    if (input && typeof input.selectionStart === "number" && typeof input.selectionEnd === "number") {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const nextValue = newMessage.slice(0, start) + emoji + newMessage.slice(end);
      setNewMessage(nextValue);
      sendTyping(nextValue.length > 0);
      setTimeout(() => {
        input.focus();
        const cursorPos = start + emoji.length;
        input.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    } else {
      const nextValue = newMessage + emoji;
      setNewMessage(nextValue);
      sendTyping(nextValue.length > 0);
    }
  };

  const dispatchMessage = async (text: string, mediaToSend?: PreparedMedia) => {
    if ((!text && !mediaToSend) || !user) return;

    const clientMsgId = generateClientMsgId();
    const nowMs = currentEpochMillis();

    // 1. Instantly broadcast via WebSocket
    sendWsMessage(
      text,
      clientMsgId,
      false,
      `@${userUsername}`,
      mediaToSend,
      userPhoto
    );

    // Optimistically show immediately
    setMessages((prev) => [
      ...prev,
      {
        id: clientMsgId,
        wsId: clientMsgId,
        text,
        senderId: user.uid,
        senderName: userName,
        senderUsername: `@${userUsername}`,
        senderPhoto: userPhoto,
        mediaUrl: mediaToSend?.url || "",
        mediaType: mediaToSend?.type || "",
        mediaName: mediaToSend?.name || "",
        createdAt: nowMs
      }
    ]);
    setTimeout(() => scrollToBottom(true), 50);

    // 2. Persist message & room preview metadata to Firestore concurrently
    try {
      const summaryPreview = text
        ? text.slice(0, 120)
        : mediaToSend
        ? mediaToSend.type === "image/gif"
          ? "Sent a GIF"
          : `Sent ${mediaToSend.type.startsWith("image/") ? "a photo" : mediaToSend.type.startsWith("video/") ? "a video" : "a file"}`
        : "Sent a message";

      await Promise.all([
        addDoc(collection(db, "rooms", roomId, "messages"), {
          text,
          senderId: user.uid,
          senderName: userName,
          senderUsername: `@${userUsername}`,
          senderPhoto: userPhoto || "",
          mediaUrl: mediaToSend?.url || "",
          mediaType: mediaToSend?.type || "",
          mediaName: mediaToSend?.name || "",
          createdAt: serverTimestamp(),
          wsId: clientMsgId,
        }),
        updateDoc(doc(db, "rooms", roomId), {
          lastMessageText: summaryPreview,
          lastMessageSender: userName,
          lastMessageSenderUsername: userUsername,
          lastMessageSenderId: user.uid,
          lastMessageAt: serverTimestamp(),
        }),
      ]);
    } catch (err) {
      console.error("Error saving message:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingMedia) || !user) return;

    const text = newMessage.trim();
    const mediaToSend = pendingMedia || undefined;
    setNewMessage("");
    setPendingMedia(null);
    setMediaError("");
    sendTyping(false);

    await dispatchMessage(text, mediaToSend);
  };

  const handleSendGif = async (gif: SelectedGif) => {
    if (!user) return;
    await dispatchMessage("", {
      url: gif.url,
      type: "image/gif",
      name: `${gif.title || "reaction"}.gif`,
    });
  };

  const handleCopyCode = () => {
    if (!room?.securityCode) return;
    navigator.clipboard.writeText(room.securityCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLeaveOrEndRoom = async () => {
    if (!user || !room) return;
    const isOwner = room.createdBy === user.uid;

    if (isOwner) {
      if (confirm("End this room for everyone?")) {
        try {
          sendWsTerminate();
          await updateDoc(doc(db, "rooms", roomId), {
            status: "terminated"
          });
        } catch (err) {
          console.error(err);
        }
      }
    } else {
      router.push("/dashboard");
    }
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center transition-colors"
        style={{ backgroundColor: "var(--pastel-bg)", color: "var(--pastel-subtext)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2" aria-hidden="true">
            <span className="portfolio-dot" />
            <span className="portfolio-dot" />
            <span className="portfolio-dot" />
          </div>
          <span className="text-xs font-bold tracking-wide uppercase">entering chat room...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 transition-colors"
        style={{ backgroundColor: "var(--pastel-bg)", color: "var(--pastel-text)" }}
      >
        <div 
          className="bg-[var(--pastel-card)] portfolio-panel p-7 portfolio-shadow text-center max-w-sm w-full"
        >
          <h2 className="text-lg font-extrabold mb-1" style={{ color: "var(--pastel-text)" }}>Room Unavailable</h2>
          <p className="text-xs mb-5" style={{ color: "var(--pastel-subtext)" }}>{error}</p>
          <button 
            onClick={() => router.push("/dashboard")}
            className="w-full py-3 font-bold rounded-full text-xs transition-all portfolio-shadow cursor-pointer"
            style={{
              backgroundColor: "var(--pastel-primary)",
              color: "var(--pastel-on-primary)",
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!user || !room) return null;

  // Password Unlock Gate
  if (room.roomPassword && !isPasswordUnlocked) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 transition-colors"
        style={{ backgroundColor: "var(--pastel-bg)", color: "var(--pastel-text)" }}
      >
        <div 
          className="max-w-sm w-full bg-[var(--pastel-card)] portfolio-panel p-7 portfolio-shadow text-center"
        >
          <div className="flex items-center justify-center gap-1.5 mb-3" aria-hidden="true">
            <span className="h-1 w-6 rounded-full" style={{ backgroundColor: "var(--portfolio-pink)" }} />
            <span className="h-1 w-6 rounded-full" style={{ backgroundColor: "var(--portfolio-green)" }} />
            <span className="h-1 w-6 rounded-full" style={{ backgroundColor: "var(--portfolio-blue)" }} />
          </div>
          <h2 className="text-lg font-extrabold" style={{ color: "var(--pastel-text)" }}>Protected Room</h2>
          <p className="text-xs mt-1 mb-4" style={{ color: "var(--pastel-subtext)" }}>
            Enter the room password to join this chat.
          </p>

          <form onSubmit={handleUnlockRoom} className="space-y-3">
            <input
              type="password"
              autoComplete="off"
              value={roomPasswordInput}
              onChange={(e) => setRoomPasswordInput(e.target.value)}
              placeholder="Enter password..."
              className="w-full px-4 py-2.5 rounded-2xl text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] bg-[var(--pastel-input)] text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)]"
              required
            />
            {passwordError && (
              <p className="text-xs font-bold" style={{ color: "var(--pastel-error-text)" }}>{passwordError}</p>
            )}
            <button
              type="submit"
              className="w-full py-3 font-bold rounded-full text-xs portfolio-shadow cursor-pointer hover:opacity-95"
              style={{
                backgroundColor: "var(--pastel-primary)",
                color: "var(--pastel-on-primary)",
              }}
            >
              Enter Room
            </button>
          </form>

          <button
            onClick={() => router.push("/dashboard")}
            className="mt-3 text-xs hover:underline font-semibold cursor-pointer"
            style={{ color: "var(--pastel-subtext)" }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isOwner = room.createdBy === user.uid;
  const otherTypingUsers = typingUsers.filter((u) => u.userId !== user.uid);
  const typingText =
    otherTypingUsers.length === 1
      ? `${otherTypingUsers[0].userName} is typing...`
      : otherTypingUsers.length > 1
      ? "Several people are typing..."
      : "";

  return (
    <div className="h-screen flex flex-col bg-[var(--pastel-bg)] text-[var(--pastel-text)] font-sans overflow-hidden">
        
      {/* Full-width Pastel Header with max-w-4xl inner alignment */}
      <header
        className="backdrop-blur-md px-4 sm:px-6 py-3 z-30 shrink-0 transition-colors"
        style={{ backgroundColor: "var(--pastel-nav)" }}
      >
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          
          {/* Left: Back & Room Info */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push("/dashboard")}
              className="px-3.5 py-1.5 rounded-full bg-[var(--pastel-card)] portfolio-shadow hover:opacity-85 text-[var(--pastel-text)] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Back to Dashboard"
            >
              <span>←</span>
              <span>Dashboard</span>
            </button>

            <div className="relative flex items-center gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-extrabold text-[var(--pastel-text)] leading-tight">
                    Chat Room
                  </h1>
                  <button
                    type="button"
                    onClick={() => connectionStatus !== "connected" && reconnect()}
                    title={connectionStatus !== "connected" ? "Click to reconnect" : "Connected"}
                    className={`w-2 h-2 rounded-full cursor-pointer ${connectionStatus === "connected" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--pastel-subtext)] font-medium">
                  <button
                    type="button"
                    onClick={() => setShowOnlineList((prev) => !prev)}
                    className="hover:underline cursor-pointer font-semibold"
                    title="View online participants"
                  >
                    {onlineUsers.length > 0 ? `${onlineUsers.length} online` : "1 in room"}
                  </button>
                  <span>&bull;</span>
                  <span className="text-[10px] capitalize">{connectionStatus === "connected" ? "Live" : "Connecting..."}</span>
                </div>
              </div>

              {/* Online Members Popover */}
              {showOnlineList && (
                <div
                  className="absolute left-0 top-full mt-2 w-56 bg-[var(--pastel-card)] rounded-2xl portfolio-shadow z-40 p-2.5 space-y-1"
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b" style={{ borderColor: "var(--pastel-border)" }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--pastel-subtext)]">
                      In This Room
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOnlineList(false)}
                      className="text-[10px] font-bold cursor-pointer"
                      style={{ color: "var(--pastel-accent-text)" }}
                    >
                      Close
                    </button>
                  </div>
                  {onlineUsers.length === 0 ? (
                    <p className="text-xs px-2 py-1.5 text-[var(--pastel-subtext)]">{userName} (You)</p>
                  ) : (
                    onlineUsers.map((ou) => (
                      <button
                        key={ou.userId}
                        type="button"
                        onClick={() => {
                          setShowOnlineList(false);
                          setViewingUser({ uid: ou.userId, name: ou.userName });
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold hover:bg-[var(--pastel-tint)] transition-colors flex items-center justify-between cursor-pointer text-[var(--pastel-text)]"
                      >
                        <span className="truncate">{ou.userName}</span>
                        <span className="text-[10px]" style={{ color: "var(--pastel-accent-text)" }}>
                          {ou.userId === user.uid ? "You" : "Profile"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Dark Mode Toggle, Notifications, Room Code & Leave Room */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeModeToggle uid={user.uid} compact />

            <NotificationBell
              currentUid={user.uid}
              activeRoomId={roomId}
              onNavigateTab={(tab) => {
                router.push(`/dashboard?tab=${tab}`);
              }}
              onNavigateRoom={(targetRoomId) => {
                if (targetRoomId !== roomId) {
                  router.push(`/room/${targetRoomId}`);
                }
              }}
            />

            {/* Room Code Badge with 1-click Copy */}
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--pastel-card)] portfolio-shadow hover:opacity-85 text-xs font-bold text-[var(--pastel-text)] transition-all cursor-pointer"
              title="Click to copy room code"
            >
              <span className="text-[10px] text-[var(--pastel-subtext)] uppercase">Code:</span>
              <span className="font-mono text-sm tracking-widest">{room.securityCode}</span>
              <span className="text-[11px] font-bold" style={{ color: "var(--pastel-accent-text)" }}>{copiedCode ? "Copied" : "Copy"}</span>
            </button>

            {/* Leave / End Room */}
            <button
              onClick={handleLeaveOrEndRoom}
              className="px-3.5 py-1.5 bg-[var(--pastel-card)] hover:opacity-90 rounded-full text-xs font-bold transition-all portfolio-shadow cursor-pointer"
              style={{ 
                color: "var(--pastel-accent-text)" 
              }}
            >
              {isOwner ? "End Room" : "Leave"}
            </button>

          </div>
        </div>
      </header>

      {/* Main Messages Feed (Unboxed, centered to max-w-4xl) */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto w-full min-h-full space-y-3.5 flex flex-col">
          {messages.length === 0 ? (
            <div className="m-auto flex flex-col items-center justify-center p-8 bg-[var(--pastel-card)] portfolio-panel portfolio-shadow max-w-sm text-center space-y-3">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="h-1 w-5 rounded-full" style={{ backgroundColor: "var(--portfolio-pink)" }} />
                <span className="h-1 w-5 rounded-full" style={{ backgroundColor: "var(--portfolio-green)" }} />
                <span className="h-1 w-5 rounded-full" style={{ backgroundColor: "var(--portfolio-blue)" }} />
              </div>
              <h3 className="text-base font-extrabold text-[var(--pastel-text)]">
                Welcome to the room
              </h3>
              <p className="text-xs text-[var(--pastel-subtext)] leading-relaxed">
                Share code <strong className="font-mono bg-[var(--pastel-tint)] px-2 py-0.5 rounded-full text-[var(--pastel-text)]">{room.securityCode}</strong> with someone to chat in real-time.
              </p>
              <button
                onClick={handleCopyCode}
                className="mt-1 px-4 py-2 bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] text-xs font-bold rounded-full portfolio-shadow hover:opacity-90 cursor-pointer"
              >
                {copiedCode ? "Copied to clipboard" : "Copy Room Code"}
              </button>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.senderId === user.uid;
              const isConsecutive = index > 0 && messages[index - 1].senderId === msg.senderId;
              const timeStr = formatTime(msg.createdAt);
              const senderPhoto = resolveAuthorPhoto(photoDir, {
                authorId: msg.senderId,
                authorPhoto: msg.senderPhoto,
                authorName: msg.senderName,
                authorUsername: msg.senderUsername,
                currentUid: user.uid,
                currentPhoto: userPhoto,
                currentName: userName,
                currentUsername: userUsername,
              });

              return (
                <div key={msg.id || index} className={`flex w-full ${isMe ? "justify-end" : "justify-start"} ${isConsecutive ? "-mt-1.5" : ""}`}>
                  <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[70%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    
                    {/* Clickable Sender Photo/Avatar */}
                    {!isMe && (
                      <button
                        type="button"
                        onClick={() =>
                          setViewingUser({
                            uid: msg.senderId,
                            name: msg.senderName,
                            username: msg.senderUsername,
                            photo: senderPhoto,
                          })
                        }
                        title={`View ${msg.senderName}'s profile`}
                        className={`w-7 h-7 rounded-full overflow-hidden bg-[var(--pastel-card)] portfolio-shadow flex items-center justify-center shrink-0 cursor-pointer hover:opacity-85 ${isConsecutive ? "opacity-0 pointer-events-none" : "opacity-100"}`}
                      >
                        <UserAvatar
                          name={msg.senderName}
                          photoUrl={senderPhoto}
                          sizeClass="w-7 h-7"
                          textClass="text-xs"
                          bgClass="bg-[var(--pastel-card)]"
                        />
                      </button>
                    )}

                    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && !isConsecutive && (
                        <button
                          type="button"
                          onClick={() =>
                            setViewingUser({
                              uid: msg.senderId,
                              name: msg.senderName,
                              username: msg.senderUsername,
                              photo: senderPhoto,
                            })
                          }
                          title={`View ${msg.senderName}'s profile`}
                          className="text-[11px] font-bold text-[var(--pastel-subtext)] hover:text-[var(--pastel-accent-text)] hover:underline mb-0.5 ml-1 cursor-pointer text-left"
                        >
                          {msg.senderName}
                        </button>
                      )}

                      {/* Chat Bubble */}
                      <div 
                        className={`px-4 py-2.5 text-sm leading-relaxed rounded-2xl space-y-1.5 ${
                          isMe 
                            ? "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] rounded-br-xs shadow-xs" 
                            : "bg-[var(--pastel-card)] text-[var(--pastel-text)] rounded-bl-xs portfolio-shadow"
                        }`}
                      >
                        {/* Media Attachment */}
                        {msg.mediaUrl && (
                          <div className="pt-0.5">
                            {msg.mediaType?.startsWith("image/") ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setLightboxImage({
                                    url: msg.mediaUrl!,
                                    name: msg.mediaName,
                                  })
                                }
                                className="block rounded-xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.mediaUrl}
                                  alt={msg.mediaName || "Shared image"}
                                  className="max-h-64 max-w-full rounded-xl object-cover"
                                />
                              </button>
                            ) : msg.mediaType?.startsWith("video/") ? (
                              <video
                                controls
                                playsInline
                                src={msg.mediaUrl}
                                className="max-h-64 max-w-full rounded-xl"
                              />
                            ) : msg.mediaType?.startsWith("audio/") ? (
                              <audio
                                controls
                                src={msg.mediaUrl}
                                className="w-56 sm:w-64 max-w-full"
                              />
                            ) : (
                              <a
                                href={msg.mediaUrl}
                                download={msg.mediaName || "attachment"}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-opacity hover:opacity-90 ${
                                  isMe
                                    ? "bg-black/10 border-black/15 text-[var(--pastel-on-primary)]"
                                    : "bg-[var(--pastel-tint)] border-[var(--pastel-border)] text-[var(--pastel-text)]"
                                }`}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="shrink-0"
                                >
                                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>
                                <span className="truncate max-w-[180px]">
                                  {msg.mediaName || "Download file"}
                                </span>
                              </a>
                            )}
                          </div>
                        )}

                        {msg.text && renderChatMessageText(msg.text)}

                        {timeStr && (
                          <div className={`text-[10px] mt-0.5 text-right select-none ${isMe ? "opacity-75" : "text-[var(--pastel-subtext)]"}`}>
                            {timeStr}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Real-time Typing indicator banner */}
          {otherTypingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-[var(--pastel-subtext)] bg-[var(--pastel-card)] px-3.5 py-1.5 rounded-full w-fit portfolio-shadow">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-[var(--pastel-primary)] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-[var(--pastel-primary)] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-[var(--pastel-primary)] rounded-full animate-bounce"></span>
              </span>
              <span>{typingText}</span>
            </div>
          )}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </main>

      {/* Input Bar */}
      <footer className="relative z-30 p-3 sm:p-4 pb-5 bg-[var(--pastel-card)] portfolio-shadow shrink-0 transition-colors">
        <div className="max-w-4xl mx-auto w-full space-y-2">
          {/* Media Error Notice */}
          {mediaError && (
            <div
              className="p-2 text-xs font-bold rounded-2xl flex items-center justify-between"
              style={{
                backgroundColor: "var(--pastel-error-bg)",
                color: "var(--pastel-error-text)",
              }}
            >
              <span>{mediaError}</span>
              <button
                type="button"
                onClick={() => setMediaError("")}
                className="text-[11px] underline cursor-pointer ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Pending Media Attachment Preview */}
          {pendingMedia && (
            <div className="p-2.5 bg-[var(--pastel-tint)] rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {pendingMedia.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingMedia.url}
                    alt={pendingMedia.name}
                    className="w-10 h-10 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-[var(--pastel-card)] text-[10px] font-bold text-[var(--pastel-accent-text)] shrink-0">
                    {pendingMedia.type.startsWith("video/")
                      ? "Video"
                      : pendingMedia.type.startsWith("audio/")
                      ? "Audio"
                      : "File"}
                  </span>
                )}
                <span className="text-xs font-bold text-[var(--pastel-text)] truncate">
                  {pendingMedia.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPendingMedia(null)}
                className="px-3 py-1 rounded-full bg-[var(--pastel-card)] text-[11px] font-bold text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)] cursor-pointer shrink-0"
              >
                Remove
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx"
              onChange={handleMediaFileChange}
              className="hidden"
            />

            {/* Media Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={preparingMedia}
              className="p-2.5 rounded-full transition-all shadow-2xs hover:opacity-85 cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-40"
              style={{
                backgroundColor: "var(--pastel-tint)",
                color: "var(--pastel-text)",
              }}
              title="Attach photo, video, audio, or file"
              aria-label="Attach media file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            {/* Emoji Keyboard */}
            <ChatEmojiPicker onSelectEmoji={handleInsertEmoji} />

            {/* GIF Picker */}
            <ChatGifPicker onSelectGif={handleSendGif} />

            <input
              ref={messageInputRef}
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                sendTyping(e.target.value.length > 0);
              }}
              placeholder="Write a message..."
              className="flex-1 py-2.5 px-4 rounded-full bg-[var(--pastel-input)] text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
              style={{
                fontFamily:
                  "var(--font-montserrat), 'Montserrat', system-ui, -apple-system, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'",
              }}
            />

            <button
              type="submit"
              disabled={(!newMessage.trim() && !pendingMedia) || preparingMedia}
              className="px-5 py-2.5 bg-[var(--pastel-primary)] hover:opacity-90 text-[var(--pastel-on-primary)] rounded-full text-xs font-bold transition-all shadow-xs disabled:opacity-40 cursor-pointer shrink-0"
            >
              {preparingMedia ? "..." : "Send"}
            </button>
          </form>
        </div>
      </footer>

      {/* Member Profile Modal */}
      <UserProfileViewModal
        uid={viewingUser?.uid || null}
        fallbackName={viewingUser?.name}
        fallbackUsername={viewingUser?.username}
        fallbackPhoto={viewingUser?.photo}
        onClose={() => setViewingUser(null)}
      />

      {/* Image Lightbox Preview */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="bg-[var(--pastel-card)] portfolio-panel p-5 max-w-2xl w-full portfolio-shadow space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--pastel-text)] truncate">
                {lightboxImage.name || "Shared photo"}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage.url}
                  download={lightboxImage.name || "photo.jpg"}
                  className="px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-[var(--pastel-tint)] text-[var(--pastel-text)] hover:opacity-85"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] cursor-pointer hover:opacity-90"
                >
                  Close
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name || "Full preview"}
              className="max-h-[75vh] w-auto mx-auto rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
