import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Track active rooms and their connected websockets
  // Room ID -> Set of sockets
  const rooms = new Map<string, Set<WebSocket & { userId?: string; userName?: string }>>();

  // Create WebSocket Server attaching to the HTTP server
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: WebSocket & { userId?: string; userName?: string }) => {
    let currentRoomId: string | null = null;

    ws.on("message", (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        const { type, roomId, userId, userName, payload } = data;

        if (type === "join") {
          currentRoomId = roomId;
          ws.userId = userId;
          ws.userName = userName;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          const room = rooms.get(roomId)!;
          room.add(ws);

          // Get other peers in this room
          const peers = Array.from(room)
            .filter((p) => p.userId !== userId)
            .map((p) => ({ userId: p.userId, userName: p.userName }));

          // Send current peer list to the newly joined client
          ws.send(JSON.stringify({
            type: "room-info",
            peers,
          }));

          // Notify existing peers that a new user joined
          room.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "peer-joined",
                userId,
                userName,
              }));
            }
          });
        } else if (type === "signal" || type === "relay") {
          // Relay WebRTC signal or fallback encrypted payload to peers in the room
          if (currentRoomId && rooms.has(currentRoomId)) {
            const room = rooms.get(currentRoomId)!;
            const targetUserId = data.targetUserId;

            room.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                // If a targetUserId is specified, send only to them. Otherwise send to everyone else.
                if (targetUserId) {
                  if (client.userId === targetUserId) {
                    client.send(JSON.stringify({
                      type: data.type === "signal" ? "signal" : "relay",
                      senderId: userId,
                      senderName: userName,
                      payload,
                    }));
                  }
                } else if (client !== ws) {
                  client.send(JSON.stringify({
                    type: "relay",
                    senderId: userId,
                    senderName: userName,
                    payload,
                  }));
                }
              }
            });
          }
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    });

    ws.on("close", () => {
      if (currentRoomId && rooms.has(currentRoomId)) {
        const room = rooms.get(currentRoomId)!;
        room.delete(ws);
        
        // Notify other clients in the room that this user disconnected
        room.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "peer-left",
              userId: ws.userId,
            }));
          }
        });

        // Clean up empty room
        if (room.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    });
  });

  // Serve static assets or use Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
