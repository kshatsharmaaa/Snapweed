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
  onMessageReceived?: (message: WebSocketMessage) => void;
  onRoomTerminated?: () => void;
}

export function useRoomWebSocket({
  roomId,
  userId,
  userName = "User",
  onMessageReceived,
  onRoomTerminated,
}: UseRoomWebSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingClearTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const isManuallyClosedRef = useRef(false);

  // Keep callback refs fresh
  const onMessageReceivedRef = useRef(onMessageReceived);
  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const onRoomTerminatedRef = useRef(onRoomTerminated);
  useEffect(() => {
    onRoomTerminatedRef.current = onRoomTerminated;
  }, [onRoomTerminated]);

  // Main WebSocket subscription effect
  useEffect(() => {
    if (!roomId || !userId || typeof window === "undefined") return;

    isManuallyClosedRef.current = false;

    // Determine WebSocket URL
    let wsUrl = process.env.NEXT_PUBLIC_WS_URL || "";
    if (!wsUrl) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/api/ws`;
    }

    const queryParams = `?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`;
    const fullUrl = `${wsUrl}${queryParams}`;

    const socket = new WebSocket(fullUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus("connected");
      reconnectAttemptsRef.current = 0;

      // Send join message
      socket.send(
        JSON.stringify({
          type: "join_room",
          roomId,
          userId,
          userName,
        })
      );

      // Heartbeat ping every 25 seconds
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);
    };

    socket.onmessage = (event) => {
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

    socket.onerror = (err) => {
      console.warn("[useRoomWebSocket] WebSocket error:", err);
      setConnectionStatus("error");
    };

    socket.onclose = () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      setConnectionStatus("disconnected");

      if (!isManuallyClosedRef.current) {
        const backoff = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          setConnectionStatus("connecting");
          setReconnectTrigger((prev) => prev + 1);
        }, backoff);
      }
    };

    const typingTimers = typingClearTimersRef.current;

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimers.forEach((timer) => clearTimeout(timer));
      typingTimers.clear();

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "leave_room",
            roomId,
            userId,
          })
        );
      }
      socket.close();
      wsRef.current = null;
    };
  }, [roomId, userId, userName, reconnectTrigger]);

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
        console.warn("[useRoomWebSocket] Socket not connected, unable to send message immediately via WS");
        return null;
      }

      const id = customId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const payload: WebSocketMessage = {
        id,
        roomId,
        text,
        senderId: userId || "anon",
        senderName: userName,
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
    [roomId, userId, userName]
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
          userName,
          isTyping,
        })
      );

      // If user started typing, auto-cancel after 2.5s if no new typing happens
      if (isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "typing",
                roomId,
                userId,
                userName,
                isTyping: false,
              })
            );
          }
        }, 2500);
      }
    },
    [roomId, userId, userName]
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
