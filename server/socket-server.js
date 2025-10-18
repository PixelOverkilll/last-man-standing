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
  cors: {
    origin: '*',
  }
});

// Lobbies: lobbyId -> { hostId, players: Map(socketId -> playerData) }
const lobbies = new Map();

function generateLobbyId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Neue Socket-Verbindung:', socket.id);

  socket.on('create-lobby', (data, cb) => {
    const lobbyId = data && data.lobbyId ? data.lobbyId : generateLobbyId();

    if (lobbies.has(lobbyId)) {
      // Lobby existiert bereits
      console.log('Lobby bereits vorhanden:', lobbyId);
      cb && cb({ ok: false, error: 'lobby-exists' });
      return;
    }

    // Erstelle Lobby
    lobbies.set(lobbyId, { hostId: socket.id, players: new Map() });
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
    const hostSocket = io.sockets.sockets.get(lobby.hostId);
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

    // Wenn Host gegangen ist, dissolve lobby
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
        const hostSock = io.sockets.sockets.get(lobby.hostId);
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
        // Host disconnected -> close lobby
        io.to(lobbyId).emit('lobby-closed', {});
        lobby.players.forEach((p, sid) => {
          const s = io.sockets.sockets.get(sid);
          if (s) s.leave(lobbyId);
        });
        lobbies.delete(lobbyId);
        console.log(`Lobby ${lobbyId} geschlossen (Host disconnected)`);
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
