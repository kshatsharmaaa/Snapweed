"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface WebSocketMessage {
  id: string;
  roomId: string;
  text: string;
  senderId: string;
  senderName: string;
  senderEmoji?: string;
  senderPhoto?: string;
  isJustOnce?: boolean;
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
  createdAt: number;
}

export interface OnlineUser {
  userId: string;
  userName: string;
}

export interface TypingUser {
  userId: string;
  userName: string;
}

interface UseRoomWebSocketOptions {
  roomId: string;
  userId?: string | null;
  userName?: string;
  enabled?: boolean;
  onMessageReceived?: (message: WebSocketMessage) => void;
  onRoomTerminated?: () => void;
}

const MAX_HANDSHAKE_RETRIES = 5;

export function useRoomWebSocket({
  roomId,
  userId,
  userName = "User",
  enabled = true,
  onMessageReceived,
  onRoomTerminated,
}: UseRoomWebSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingClearTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectAttemptsRef = useRef(0);

  const userNameRef = useRef(userName);
  useEffect(() => {
    const prevName = userNameRef.current;
    userNameRef.current = userName;
    if (
      prevName !== userName &&
      roomId &&
      userId &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: "update_profile",
          roomId,
          userId,
          userName,
        })
      );
    }
  }, [roomId, userId, userName]);

  const onMessageReceivedRef = useRef(onMessageReceived);
  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const onRoomTerminatedRef = useRef(onRoomTerminated);
  useEffect(() => {
    onRoomTerminatedRef.current = onRoomTerminated;
  }, [onRoomTerminated]);

  // Main WebSocket subscription effect: scoped cleanup prevents stale sockets from triggering reconnect loops
  useEffect(() => {
    if (!enabled || !roomId || !userId || typeof window === "undefined") {
      return;
    }

    let disposed = false;
    let opened = false;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let cleanupForceCloseTimer: NodeJS.Timeout | null = null;

    let wsUrl = (process.env.NEXT_PUBLIC_WS_URL || "").trim();
    if (!wsUrl) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/api/ws`;
    }

    const sep = wsUrl.includes("?") ? "&" : "?";
    const queryParams = `${sep}roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userNameRef.current)}`;
    const fullUrl = `${wsUrl}${queryParams}`;

    const socket = new WebSocket(fullUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      if (disposed || wsRef.current !== socket) {
        try {
          socket.close(1000, "Cleanup");
        } catch {}
        return;
      }

      opened = true;
      reconnectAttemptsRef.current = 0;
      setConnectionStatus("connected");

      socket.send(
        JSON.stringify({
          type: "join_room",
          roomId,
          userId,
          userName: userNameRef.current,
        })
      );

      pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);
    };

    socket.onmessage = (event) => {
      if (disposed || wsRef.current !== socket) return;

      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "room_joined":
          case "online_users":
          case "user_joined":
            if (Array.isArray(data.onlineUsers)) {
              setOnlineUsers(data.onlineUsers);
            }
            break;

          case "user_left":
            if (Array.isArray(data.onlineUsers)) {
              setOnlineUsers(data.onlineUsers);
            }
            setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
            break;

          case "chat_message":
            if (data.message && onMessageReceivedRef.current) {
              onMessageReceivedRef.current(data.message);
            }
            break;

          case "typing": {
            const { userId: typingUserId, userName: typingUserName, isTyping } = data;
            if (!typingUserId || typingUserId === userId) break;

            const existingTimer = typingClearTimersRef.current.get(typingUserId);
            if (existingTimer) clearTimeout(existingTimer);

            if (isTyping) {
              setTypingUsers((prev) => {
                if (prev.some((u) => u.userId === typingUserId)) return prev;
                return [...prev, { userId: typingUserId, userName: typingUserName || "Someone" }];
              });

              const timer = setTimeout(() => {
                setTypingUsers((prev) => prev.filter((u) => u.userId !== typingUserId));
                typingClearTimersRef.current.delete(typingUserId);
              }, 3500);
              typingClearTimersRef.current.set(typingUserId, timer);
            } else {
              setTypingUsers((prev) => prev.filter((u) => u.userId !== typingUserId));
              typingClearTimersRef.current.delete(typingUserId);
            }
            break;
          }

          case "room_terminated":
            if (onRoomTerminatedRef.current) {
              onRoomTerminatedRef.current();
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error("[useRoomWebSocket] Failed to parse message:", err);
      }
    };

    socket.onerror = () => {
      if (disposed || wsRef.current !== socket) return;
      setConnectionStatus("error");
    };

    socket.onclose = () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (disposed || wsRef.current !== socket) return;

      wsRef.current = null;

      if (!opened && reconnectAttemptsRef.current >= MAX_HANDSHAKE_RETRIES) {
        setConnectionStatus("error");
        return;
      }

      setConnectionStatus("disconnected");

      const backoff = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
      reconnectAttemptsRef.current += 1;
      reconnectTimer = setTimeout(() => {
        if (disposed) return;
        setConnectionStatus("connecting");
        setReconnectTrigger((prev) => prev + 1);
      }, backoff);
    };

    const typingTimers = typingClearTimersRef.current;

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingInterval) clearInterval(pingInterval);
      if (cleanupForceCloseTimer) clearTimeout(cleanupForceCloseTimer);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimers.forEach((timer) => clearTimeout(timer));
      typingTimers.clear();

      if (wsRef.current === socket) {
        wsRef.current = null;
      }

      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (socket.readyState === WebSocket.OPEN) {
        socket.onopen = null;
        try {
          socket.send(
            JSON.stringify({
              type: "leave_room",
              roomId,
              userId,
            })
          );
          socket.close(1000, "Effect cleanup");
        } catch {}
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.onopen = () => {
          if (cleanupForceCloseTimer) clearTimeout(cleanupForceCloseTimer);
          try {
            socket.close(1000, "Effect cleanup");
          } catch {}
        };
        cleanupForceCloseTimer = setTimeout(() => {
          try {
            socket.close();
          } catch {}
        }, 1500);
      } else {
        socket.onopen = null;
      }
    };
  }, [enabled, roomId, userId, reconnectTrigger]);

  // Send a chat message over WebSocket
  const sendMessage = useCallback(
    (
      text: string,
      customId?: string,
      isJustOnce?: boolean,
      senderEmoji?: string,
      media?: { url: string; type: string; name: string },
      senderPhoto?: string
    ) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return null;
      }

      const id =
        customId ||
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const payload: WebSocketMessage = {
        id,
        roomId,
        text,
        senderId: userId || "anon",
        senderName: userNameRef.current,
        senderEmoji: senderEmoji || "",
        senderPhoto: senderPhoto || "",
        isJustOnce: Boolean(isJustOnce),
        mediaUrl: media?.url || "",
        mediaType: media?.type || "",
        mediaName: media?.name || "",
        createdAt: Date.now(),
      };

      wsRef.current.send(JSON.stringify({ type: "chat_message", ...payload }));
      return id;
    },
    [roomId, userId]
  );

  // Send typing notification
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      wsRef.current.send(
        JSON.stringify({
          type: "typing",
          roomId,
          userId,
          userName: userNameRef.current,
          isTyping,
        })
      );

      if (isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "typing",
                roomId,
                userId,
                userName: userNameRef.current,
                isTyping: false,
              })
            );
          }
        }, 2500);
      }
    },
    [roomId, userId]
  );

  // Broadcast room termination to all room participants
  const terminateRoom = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        type: "terminate_room",
        roomId,
        userId,
      })
    );
  }, [roomId, userId]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setConnectionStatus("connecting");
    setReconnectTrigger((prev) => prev + 1);
  }, []);

  return {
    connectionStatus,
    onlineUsers,
    typingUsers,
    sendMessage,
    sendTyping,
    terminateRoom,
    reconnect,
  };
}
