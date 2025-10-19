// Minimaler Socket.IO WebSocket-Server mit Lobby-Verwaltung
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = process.env.PORT || 3000;

// Statische Dateien aus dem Projekt-Root servieren (index.html etc.)
app.use(express.static(path.join(__dirname, '..')));

const server = http.createServer(app);
const io = new Server(server, {
  // Use ALLOWED_ORIGINS env var (comma-separated) or fall back to the production Render URL
  cors: {
    origin: (function(){
      try {
        if (process.env.ALLOWED_ORIGINS) {
          return process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
        }
      } catch (e) {}
      return ['https://last-man-standing-1.onrender.com'];
    })(),
    credentials: true
  }
});

// Lobbies: lobbyId -> { hostId, players: Map(socketId -> playerData), hostDisconnectTimer }
const lobbies = new Map();

const HOST_GRACE_MS = 10000; // Zeit, die gewährt wird, bevor eine Lobby endgültig geschlossen wird (ms)

function generateLobbyId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Neue Socket-Verbindung:', socket.id);

  socket.on('create-lobby', (data, cb) => {
    const lobbyId = data && data.lobbyId ? data.lobbyId : generateLobbyId();

    if (lobbies.has(lobbyId)) {
      const existing = lobbies.get(lobbyId);
      // Wenn Lobby existiert, aber Host verloren ging (hostId === null), erlauben wir Übernahme
      if (!existing.hostId) {
        console.log('Lobby existiert ohne Host, übernehme Lobby:', lobbyId, 'für', socket.id);
        // clear any pending timer
        if (existing.hostDisconnectTimer) {
          clearTimeout(existing.hostDisconnectTimer);
          existing.hostDisconnectTimer = null;
        }
        existing.hostId = socket.id;
        socket.join(lobbyId);
        socket.data.player = data && data.player ? data.player : { id: socket.id, name: 'Host', avatar: '' };
        console.log(`Lobby ${lobbyId} wieder übernommen von ${socket.id}`);
        cb && cb({ ok: true, lobbyId });
        return;
      }

      // Wenn Lobby aktiv ist mit Host, lehnen wir ab
      console.log('Lobby bereits vorhanden und aktiv:', lobbyId);
      cb && cb({ ok: false, error: 'lobby-exists' });
      return;
    }

    // Erstelle Lobby neu
    lobbies.set(lobbyId, { hostId: socket.id, players: new Map(), hostDisconnectTimer: null });
    socket.join(lobbyId);

    // Optional host metadata
    socket.data.player = data && data.player ? data.player : { id: socket.id, name: 'Host', avatar: '' };

    console.log(`Lobby ${lobbyId} erstellt von ${socket.id}`);
    cb && cb({ ok: true, lobbyId });
  });

  socket.on('join-lobby', (data, cb) => {
    const lobbyId = data && data.lobbyId;
    const player = data && data.player ? data.player : { id: socket.id, name: 'Spieler', avatar: '' };

    if (!lobbyId || !lobbies.has(lobbyId)) {
      cb && cb({ ok: false, error: 'lobby-not-found' });
      return;
    }

    const lobby = lobbies.get(lobbyId);
    lobby.players.set(socket.id, player);
    socket.join(lobbyId);
    socket.data.player = player;

    // Sende aktuelles Lobby-State an den neuen Teilnehmer
    const players = Array.from(lobby.players.values());
    const hostSocket = lobby.hostId ? io.sockets.sockets.get(lobby.hostId) : null;
    const hostInfo = hostSocket ? hostSocket.data.player : null;

    socket.emit('lobby-state', { host: hostInfo, players });

    // Benachrichtige alle anderen in der Lobby
    socket.to(lobbyId).emit('player-joined', { player });

    console.log(`${player.name} (${socket.id}) ist Lobby ${lobbyId} beigetreten`);

    cb && cb({ ok: true });
  });

  socket.on('leave-lobby', (data, cb) => {
    const lobbyId = data && data.lobbyId;
    if (!lobbyId || !lobbies.has(lobbyId)) {
      cb && cb({ ok: false, error: 'lobby-not-found' });
      return;
    }

    const lobby = lobbies.get(lobbyId);
    const player = lobby.players.get(socket.id);
    lobby.players.delete(socket.id);
    socket.leave(lobbyId);

    socket.to(lobbyId).emit('player-left', { playerId: socket.id });

    // Wenn Host gegangen ist, dissolve lobby (host voluntarily left)
    if (lobby.hostId === socket.id) {
      // Benachrichtige alle verbleibenden über Auflösung
      io.to(lobbyId).emit('lobby-closed', {});
      // Entferne alle Spieler aus Raum
      lobby.players.forEach((p, sid) => {
        const s = io.sockets.sockets.get(sid);
        if (s) s.leave(lobbyId);
      });
      lobbies.delete(lobbyId);
      console.log(`Lobby ${lobbyId} vom Host (${socket.id}) geschlossen`);
    } else {
      console.log(`Socket ${socket.id} hat Lobby ${lobbyId} verlassen`);
    }

    cb && cb({ ok: true });
  });

  // Allgemeine Lobby-Nachrichten: payload should contain { lobbyId, type, data, target, targetId }
  socket.on('lobby-message', (payload) => {
    try {
      const { lobbyId, type, data, target, targetId } = payload || {};
      if (!lobbyId || !lobbies.has(lobbyId)) return;
      const lobby = lobbies.get(lobbyId);

      // Wenn targetId gesetzt -> sende nur an diesen Socket
      if (targetId) {
        const targetSock = io.sockets.sockets.get(targetId);
        if (targetSock) targetSock.emit(type, data);
        return;
      }

      // Wenn target === 'host' -> sende nur an host
      if (target === 'host') {
        const hostSock = lobby.hostId ? io.sockets.sockets.get(lobby.hostId) : null;
        if (hostSock) hostSock.emit(type, data);
        return;
      }

      // Sonst sende an alle in Lobby (inkl. Sender)
      io.to(lobbyId).emit(type, data);

      // Zusätzliche serverseitige Aktionen, z.B. score-update persistence
      if (type === 'score-update') {
        // propagate as-is (already emitted)
      }
    } catch (err) {
      console.error('Fehler bei lobby-message:', err);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket getrennt:', socket.id, 'Grund:', reason);

    // Entferne Spieler aus allen Lobbies, falls vorhanden
    for (const [lobbyId, lobby] of lobbies.entries()) {
      if (lobby.hostId === socket.id) {
        // Host disconnected -> don't immediately close lobby; start grace timer
        console.log(`Host ${socket.id} disconnected from lobby ${lobbyId}, starting grace timer (${HOST_GRACE_MS}ms)`);
        // mark host as null so others can still join and see host missing
        lobby.hostId = null;
        // notify clients that host is temporarily disconnected
        io.to(lobbyId).emit('host-disconnected-temporary', {});
        // start a timer to fully close lobby if no new host claims it
        lobby.hostDisconnectTimer = setTimeout(() => {
          const cur = lobbies.get(lobbyId);
          if (cur && !cur.hostId) {
            console.log(`Grace period expired: closing lobby ${lobbyId}`);
            io.to(lobbyId).emit('lobby-closed', {});
            cur.players.forEach((p, sid) => {
              const s = io.sockets.sockets.get(sid);
              if (s) s.leave(lobbyId);
            });
            lobbies.delete(lobbyId);
          }
        }, HOST_GRACE_MS);

      } else if (lobby.players.has(socket.id)) {
        lobby.players.delete(socket.id);
        io.to(lobbyId).emit('player-left', { playerId: socket.id });
        console.log(`Spieler ${socket.id} aus Lobby ${lobbyId} entfernt (disconnect)`);
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Socket-Server läuft auf http://localhost:${port}`);
});
