const io = require('socket.io-client');

const SERVER = 'http://localhost:3000';
const LOBBY_ID = 'GRACE1';

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

async function run() {
  console.log('Test: Host erstellt Lobby, trennt, neuer Host übernimmt innerhalb Grace-Period');

  const host = io(SERVER, { reconnection: false });

  host.on('connect', async () => {
    console.log('[host] connected', host.id);
    host.emit('create-lobby', { lobbyId: LOBBY_ID, player: { id: 'host1', name: 'Host1' } }, (res) => {
      console.log('[host] create-lobby cb', res);
    });

    // Warte kurz, dann trenne Host (simuliere transient disconnect / navigation)
    await wait(500);
    console.log('[host] disconnecting to simulate transient loss');
    host.close();

    // Warte weniger als grace period, dann neuer host versucht Übernahme
    await wait(3000);

    const newHost = io(SERVER, { reconnection: false });
    newHost.on('connect', () => {
      console.log('[newHost] connected', newHost.id, 'attempting to create same lobby');
      newHost.emit('create-lobby', { lobbyId: LOBBY_ID, player: { id: 'host2', name: 'Host2' } }, (res) => {
        console.log('[newHost] create-lobby cb', res);
        // close after a little
        setTimeout(() => {
          newHost.close();
          console.log('[newHost] finished test');
          process.exit(0);
        }, 500);
      });
    });

    newHost.on('connect_error', (err) => { console.error('[newHost] connect_error', err); process.exit(1); });
  });

  host.on('connect_error', (err) => { console.error('[host] connect_error', err); process.exit(1); });
}

run().catch(err => { console.error(err); process.exit(1); });

