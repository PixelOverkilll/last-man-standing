const fs = require('fs');
const path = require('path');
const filePath = path.resolve(__dirname, 'js', 'app.js');
const backupPath = filePath + '.autopatch.bak';
console.log('file:', filePath);
let s = fs.readFileSync(filePath, 'utf8');
fs.writeFileSync(backupPath, s, 'utf8');
console.log('Backup written to', backupPath);
const start = '// Create Lobby Button';
const end = '// Generate random lobby code';
const si = s.indexOf(start);
const ei = s.indexOf(end);
if (si === -1 || ei === -1) {
  console.error('Start or end marker not found');
  process.exit(2);
}
const before = s.slice(0, si);
const after = s.slice(ei); // includes the end marker
const newBlock = `
  // Create Lobby Button
  createLobbyBtn.addEventListener('click', async function() {
    // WICHTIG: Prüfe ob User eingeloggt ist
    const storedUser = localStorage.getItem('discordUser');

    if (!storedUser) {
      console.error('❌ Kein Discord User gefunden! Bitte melde dich zuerst an.');
      alert('Bitte melde dich zuerst mit Discord an!');
      return;
    }

    // Admin-Passwort abfragen
    const adminPassword = prompt('🔐 Admin-Passwort eingeben um Lobby zu erstellen:');
    if (adminPassword !== 'PXL339') {
      alert('❌ Falsches Passwort! Lobby kann nicht erstellt werden.');
      console.error('❌ Falsches Admin-Passwort');
      return;
    }

    const userData = JSON.parse(storedUser);
    const localLobbyCode = generateLobbyCode();

    // Zeige Code sofort im Eingabefeld
    lobbyCodeInput.value = localLobbyCode;
    updateJoinButtonState();

    const socket = window.__LMS_SOCKET;
    if (socket && socket.connected) {
      try {
        socket.emit('create-lobby', { lobbyId: localLobbyCode, host: { id: userData.id, username: userData.username } }, (res) => {
          console.log('[app] create-lobby ack', res);
          if (res && (res.ok === true || res.lobbyId)) {
            const finalCode = res.lobbyId || localLobbyCode;
            try { localStorage.setItem('lobbyCode', finalCode); localStorage.setItem('isHost', 'true'); } catch(e){}
            lobbyCodeInput.value = finalCode;
            window.location.href = `lobby.html?code=${finalCode}`;
          } else {
            alert('Erstellen der Lobby fehlgeschlagen: ' + (res && res.error ? res.error : 'Unbekannter Fehler'));
            console.error('[app] create-lobby failed', res);
          }
        });
      } catch (err) {
        console.error('[app] Fehler beim Senden von create-lobby über Socket:', err);
        try { localStorage.setItem('lobbyCode', localLobbyCode); localStorage.setItem('isHost', 'true'); } catch(e){}
        window.location.href = `lobby.html?code=${localLobbyCode}`;
      }
    } else {
      console.warn('[app] kein Socket verfügbar, verwende Fallback für Lobby-Erstellung');
      try { localStorage.setItem('lobbyCode', localLobbyCode); localStorage.setItem('isHost', 'true'); } catch(e){}
      window.location.href = `lobby.html?code=${localLobbyCode}`;
    }
  });

  // Join Lobby Button
  joinLobbyBtn.addEventListener('click', function() {
    if (!isLobbyCodeValid()) return;

    const storedUser = localStorage.getItem('discordUser');
    if (!storedUser) {
      console.error('❌ Kein Discord User gefunden! Bitte melde dich zuerst an.');
      alert('Bitte melde dich zuerst mit Discord an!');
      return;
    }

    const userData = JSON.parse(storedUser);
    const code = lobbyCodeInput.value.trim();

    const socket = window.__LMS_SOCKET;
    if (socket && socket.connected) {
      try {
        socket.emit('join-lobby', { lobbyId: code, player: { id: userData.id, username: userData.username } }, (res) => {
          console.log('[app] join-lobby ack', res);
          if (res && res.ok) {
            try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'false'); } catch(e){}
            window.location.href = `lobby.html?code=${code}`;
          } else {
            alert('Beitreten der Lobby fehlgeschlagen: ' + (res && res.error ? res.error : 'Lobby nicht gefunden oder geschlossen'));
            console.error('[app] join-lobby failed', res);
          }
        });
      } catch (err) {
        console.error('[app] Fehler beim Senden von join-lobby über Socket:', err);
        try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'false'); } catch(e){}
        window.location.href = `lobby.html?code=${code}`;
      }
    } else {
      console.warn('[app] kein Socket verfügbar, verwende Fallback für Lobby-Beitritt');
      try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'false'); } catch(e){}
      window.location.href = `lobby.html?code=${code}`;
    }
  });
`;

const newContent = before + start + newBlock + after;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Patched file written.');
`);
