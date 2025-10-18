// Host-Test (einmalig): erstellt eine Lobby, gibt die ID aus und beendet sich
const io = require('socket.io-client');
const SERVER = process.env.SERVER || 'http://localhost:3000';

const socket = io(SERVER, { reconnectionAttempts: 3, timeout: 5000 });

socket.on('connect', () => {
  console.log('[test-host-once] connected', socket.id);
  socket.emit('create-lobby', { player: { id: socket.id, name: 'OneShotHost', avatar: '' } }, (res) => {
    if (!res || !res.ok) {
      console.error('[test-host-once] create-lobby failed', res);
      process.exit(2);
    }
    console.log('[test-host-once] lobby created', res.lobbyId);
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (err) => {
  console.error('[test-host-once] connect_error', err.message || err);
  process.exit(2);
});

