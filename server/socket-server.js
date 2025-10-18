// Minimaler Socket.IO WebSocket-Server
// Serviert statische Dateien aus dem Projekt-Root und stellt eine Socket.IO-API bereit

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

io.on('connection', (socket) => {
  console.log('Neue Socket-Verbindung:', socket.id);

  socket.on('create-lobby', (data, cb) => {
    console.log('create-lobby', socket.id, data);
    // Demo: lobbyId generieren und zurückgeben
    const lobbyId = Math.random().toString(36).slice(2, 8).toUpperCase();
    socket.join(lobbyId);
    cb && cb({ ok: true, lobbyId });
  });

  socket.on('join-lobby', (data, cb) => {
    console.log('join-lobby', socket.id, data);
    const { lobbyId } = data || {};
    // Einfacher Check: Raum beitreten
    socket.join(lobbyId);
    io.to(lobbyId).emit('player-joined', { id: socket.id });
    cb && cb({ ok: true });
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket getrennt:', socket.id, 'Grund:', reason);
  });
});

server.listen(port, () => {
  console.log(`Socket-Server läuft auf http://localhost:${port}`);
});

