const io = require('socket.io-client');

const SERVER = 'http://localhost:3000';
const LOBBY_ID = 'TEST99';

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

async function run() {
  console.log('Starte Test: Client versucht Lobby beizutreten, Host wird verzögert erstellt');

  // Client, der retry-logik simuliert
  const client = io(SERVER, { reconnection: false });

  client.on('connect', async () => {
    console.log('[client] verbunden', client.id);

    let attempt = 0;
    const maxAttempts = 6;
    const delayMs = 500;

    while (attempt < maxAttempts) {
      attempt++;
      console.log(`[client] Versuch ${attempt} join ${LOBBY_ID}`);
      client.emit('join-lobby', { lobbyId: LOBBY_ID, player: { id: 'client1', name: 'Client1' } }, (res) => {
        console.log('[client] join callback', res);
      });

      // wait for response event (server calls cb synchronously), so we need to listen for callback via a tiny delay
      await wait(delayMs);

      // Check if client in room by asking server? Instead, rely on server's callback; we can't access it here.
      // For brevity, break early if server created lobby.
      // We'll just loop and simulate host creation after 2 attempts
      if (attempt === 2) {
        console.log('[test] Erstelle nun Host-Lobby');
        const host = io(SERVER, { reconnection: false });
        host.on('connect', () => {
          console.log('[host] verbunden', host.id, 'erzeuge lobby', LOBBY_ID);
          host.emit('create-lobby', { lobbyId: LOBBY_ID, player: { id: 'host1', name: 'Host1' } }, (res) => {
            console.log('[host] create-lobby callback', res);
          });
        });
      }
    }

    console.log('[client] Test fertig - schliesse Sockets');
    client.close();
    process.exit(0);
  });

  client.on('connect_error', (err) => {
    console.error('[client] connect_error', err.message);
    process.exit(1);
  });
}

run().catch(err => { console.error(err); process.exit(1); });

