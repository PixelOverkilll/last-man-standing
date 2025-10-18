// Einfacher Host-Test: erstellt eine Lobby und bleibt verbunden, um Join-Events zu empfangen.
const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');
const SERVER = process.env.SERVER || 'http://localhost:3000';

const socket = io(SERVER, { reconnectionAttempts: 3, timeout: 5000 });

socket.on('connect', () => {
  console.log('[test-host] connected', socket.id);
  socket.emit('create-lobby', { player: { id: socket.id, name: 'TestHost', avatar: '' } }, (res) => {
    if (!res || !res.ok) {
      console.error('[test-host] create-lobby failed', res);
      process.exit(2);
    }
    console.log('[test-host] lobby created', res.lobbyId);

    try {
      fs.writeFileSync(path.join(__dirname, 'last_lobby_id.txt'), res.lobbyId, 'utf8');
      console.log('[test-host] lobby id written to server/last_lobby_id.txt');
    } catch (e) {
      console.warn('[test-host] failed to write lobby id file', e.message);
    }

    console.log('[test-host] waiting for players... (press CTRL+C to exit)');

    // keep process alive until manually terminated
    // process.stdin.resume() ensures the node process doesn't exit
    process.stdin.resume();
  });
});

socket.on('player-joined', (payload) => {
  console.log('[test-host] player-joined', payload);
});

socket.on('disconnect', (reason) => {
  console.log('[test-host] disconnected', reason);
});
