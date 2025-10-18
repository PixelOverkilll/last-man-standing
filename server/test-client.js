// Ein einfacher Test-Client, der sich mit dem Socket.IO-Server verbindet, einen Lobby-Create-Event sendet und das Ergebnis loggt.
const io = require('socket.io-client');

const SERVER = process.env.SERVER || 'http://localhost:3000';
console.log('Connecting to', SERVER);

const socket = io(SERVER, { reconnectionAttempts: 3, timeout: 5000 });

socket.on('connect', () => {
  console.log('[test-client] connected', socket.id);
  socket.emit('create-lobby', { test: true }, (res) => {
    console.log('[test-client] create-lobby response', res);
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (err) => {
  console.error('[test-client] connect_error', err.message || err);
  process.exit(2);
});

socket.on('disconnect', (reason) => {
  console.log('[test-client] disconnected:', reason);
});

