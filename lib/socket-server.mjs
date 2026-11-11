import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import crypto from 'crypto';

// Map of roomId -> Map of clientId -> { ws, userId, userName, joinedAt }
const roomClients = new Map();

// Map of roomId -> Array of recent messages (up to 50)
const roomMessageHistory = new Map();

const MAX_HISTORY_PER_ROOM = 50;

/**
 * Broadcasts a message to all connected clients in a room
 * @param {string} roomId 
 * @param {object} payload 
 * @param {WebSocket} [excludeWs] 
 */
function broadcastToRoom(roomId, payload, excludeWs = null) {
  const clients = roomClients.get(roomId);
  if (!clients) return;

  const data = JSON.stringify(payload);
  for (const [, client] of clients) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

/**
 * Gets unique online users in a room
 * @param {string} roomId 
 * @returns {Array<{ userId: string, userName: string }>}
 */
function getOnlineUsers(roomId) {
  const clients = roomClients.get(roomId);
  if (!clients) return [];

  const unique = new Map();
  for (const [, client] of clients) {
    if (client.userId && !unique.has(client.userId)) {
      unique.set(client.userId, {
        userId: client.userId,
        userName: client.userName || 'Anonymous'
      });
    }
  }
  return Array.from(unique.values());
}

/**
 * Removes a client from a room
 */
function removeClientFromRoom(roomId, clientId) {
  const clients = roomClients.get(roomId);
  if (!clients) return;

  const client = clients.get(clientId);
  if (!client) return;

  clients.delete(clientId);

  // If room is now empty, cleanup
  if (clients.size === 0) {
    roomClients.delete(roomId);
  } else {
    // Notify room of updated online users
    const onlineUsers = getOnlineUsers(roomId);
    broadcastToRoom(roomId, {
      type: 'user_left',
      roomId,
      userId: client.userId,
      userName: client.userName,
      onlineUsers
    });
  }
}

/**
 * Attaches the WebSocket server to an existing HTTP server
 * @param {import('http').Server} httpServer
 * @returns {WebSocketServer}
 */
export function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade event
  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      // Only handle our WebSocket endpoints
      if (pathname === '/api/ws' || pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
      // Leave all other upgrade requests (e.g. Next.js HMR) untouched!
    } catch (err) {
      console.error('[WebSocket] Upgrade error:', err);
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const clientId = crypto.randomUUID();
    let currentRoomId = null;
    let currentUserId = null;
    let currentUserName = 'Anonymous';

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Check if query parameters were provided on connection URL
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const qRoomId = url.searchParams.get('roomId');
      const qUserId = url.searchParams.get('userId');
      const qUserName = url.searchParams.get('userName');

      if (qRoomId && qUserId) {
        handleJoin(qRoomId, qUserId, qUserName || 'Anonymous');
      }
    } catch {
      // Ignored if URL parsing fails
    }

    function handleJoin(roomId, userId, userName) {
      const nextName = userName || 'Anonymous';
      const existingClient = roomClients.get(roomId)?.get(clientId);
      if (existingClient && currentRoomId === roomId && currentUserId === userId) {
        if (existingClient.userName !== nextName) {
          existingClient.userName = nextName;
          currentUserName = nextName;
          const onlineUsers = getOnlineUsers(roomId);
          broadcastToRoom(roomId, {
            type: 'online_users',
            roomId,
            onlineUsers
          });
        }
        return;
      }

      if (currentRoomId && currentRoomId !== roomId) {
        removeClientFromRoom(currentRoomId, clientId);
      }

      currentRoomId = roomId;
      currentUserId = userId;
      currentUserName = nextName;

      if (!roomClients.has(roomId)) {
        roomClients.set(roomId, new Map());
      }

      roomClients.get(roomId).set(clientId, {
        ws,
        userId: currentUserId,
        userName: currentUserName,
        joinedAt: Date.now()
      });

      const onlineUsers = getOnlineUsers(roomId);
      const history = roomMessageHistory.get(roomId) || [];

      // Acknowledge join to the sender
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'room_joined',
          roomId,
          userId: currentUserId,
          onlineUsers,
          history
        }));
      }

      // Notify others in room
      broadcastToRoom(roomId, {
        type: 'user_joined',
        roomId,
        userId: currentUserId,
        userName: currentUserName,
        onlineUsers
      }, ws);
    }

    ws.on('message', (rawData) => {
      ws.isAlive = true;
      try {
        const data = JSON.parse(rawData.toString());

        switch (data.type) {
          case 'join_room': {
            const { roomId, userId, userName } = data;
            if (roomId && userId) {
              handleJoin(roomId, userId, userName);
            }
            break;
          }

          case 'update_profile': {
            const { roomId, userId, userName } = data;
            if (roomId && userId) {
              handleJoin(roomId, userId, userName);
            }
            break;
          }

          case 'leave_room': {
            if (currentRoomId) {
              removeClientFromRoom(currentRoomId, clientId);
              currentRoomId = null;
            }
            break;
          }

          case 'chat_message': {
            const {
              roomId,
              text,
              senderId,
              senderName,
              id,
              createdAt,
              senderEmoji,
              senderPhoto,
              isJustOnce,
              mediaUrl,
              mediaType,
              mediaName,
            } = data;
            if (!roomId || (!text && !mediaUrl) || !senderId) return;

            const message = {
              id: id || crypto.randomUUID(),
              roomId,
              text: text || '',
              senderId,
              senderName: senderName || currentUserName,
              senderEmoji: senderEmoji || '',
              senderPhoto: senderPhoto || '',
              isJustOnce: Boolean(isJustOnce),
              mediaUrl: mediaUrl || '',
              mediaType: mediaType || '',
              mediaName: mediaName || '',
              createdAt: createdAt || Date.now()
            };

            // Store in memory buffer
            if (!roomMessageHistory.has(roomId)) {
              roomMessageHistory.set(roomId, []);
            }
            const history = roomMessageHistory.get(roomId);
            history.push(message);
            if (history.length > MAX_HISTORY_PER_ROOM) {
              history.shift();
            }

            // Broadcast message to all clients in the room (including sender for acknowledgment)
            broadcastToRoom(roomId, {
              type: 'chat_message',
              roomId,
              message
            });
            break;
          }

          case 'typing': {
            const { roomId, isTyping } = data;
            if (!roomId || !currentUserId) return;

            // Broadcast typing state to other clients in room
            broadcastToRoom(roomId, {
              type: 'typing',
              roomId,
              userId: currentUserId,
              userName: currentUserName,
              isTyping: Boolean(isTyping)
            }, ws);
            break;
          }

          case 'terminate_room': {
            const { roomId } = data;
            if (!roomId) return;

            // Notify all clients in the room
            broadcastToRoom(roomId, {
              type: 'room_terminated',
              roomId,
              terminatedBy: currentUserId
            });

            // Clean up room state
            roomClients.delete(roomId);
            roomMessageHistory.delete(roomId);
            break;
          }

          case 'ping': {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
            break;
          }

          default:
            console.warn('[WebSocket] Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('[WebSocket] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomId) {
        removeClientFromRoom(currentRoomId, clientId);
      }
    });

    ws.on('error', (err) => {
      console.error(`[WebSocket] Client error (${clientId}):`, err);
    });
  });

  // Heartbeat interval to prune dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WebSocket] Server initialized on /api/ws and /ws');
  return wss;
}

// Support running standalone if executed directly via node
const isMainModule = process.argv[1] && process.argv[1].endsWith('socket-server.mjs');
if (isMainModule) {
  const port = parseInt(process.env.WS_PORT || '3001', 10);
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'Snapweed WebSocket Server' }));
  });

  setupWebSocketServer(server);

  server.listen(port, () => {
    console.log(`[WebSocket Standalone] Server running at http://localhost:${port}`);
  });
}

