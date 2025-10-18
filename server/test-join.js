// Einfacher Join-Test: tritt einer bestehenden Lobby bei (env LOBBY=LOBBYID oder arg)
const io = require('socket.io-client');
const LOBBY = process.env.LOBBY || process.argv[2];
const SERVER = process.env.SERVER || 'http://localhost:3000';

if (!LOBBY) {
  console.error('Usage: LOBBY=<lobbyId> node server/test-join.js <lobbyId>');
  process.exit(2);
}

const socket = io(SERVER, { reconnectionAttempts: 3, timeout: 5000 });

socket.on('connect', () => {
  console.log('[test-join] connected', socket.id);
  socket.emit('join-lobby', { lobbyId: LOBBY, player: { id: socket.id, name: 'TestPlayer', avatar: '' } }, (res) => {
    if (!res || !res.ok) {
      console.error('[test-join] join-lobby failed', res);
      process.exit(2);
    }
    console.log('[test-join] joined lobby', LOBBY);
    // wait a moment for any events
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 1500);
  });
});

socket.on('lobby-state', (data) => {
  console.log('[test-join] lobby-state', data);
});

socket.on('player-joined', (p) => {
  console.log('[test-join] player-joined', p);
});

socket.on('disconnect', (reason) => {
  console.log('[test-join] disconnected', reason);
});

