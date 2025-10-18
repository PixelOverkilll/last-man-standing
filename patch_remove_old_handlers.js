const fs = require('fs');
const path = require('path');
const filePath = path.resolve(__dirname, 'js', 'app.js');
const bak = filePath + '.bak_before_cleanup';
let text = fs.readFileSync(filePath, 'utf8');
fs.writeFileSync(bak, text, 'utf8');
console.log('Backup saved to', bak);

// Patterns to detect old handler blocks (short unique markers)
const oldCreateMarker = "🎮 Erstelle Lobby mit Code";
const oldJoinMarker = "🎮 Trete Lobby bei mit Code";

if (text.indexOf(oldCreateMarker) === -1 && text.indexOf("socket.emit('create-lobby'") !== -1) {
  console.log('No old create marker found, but socket-based create-lobby may already be present.');
}

// We'll replace any occurrence of the old pattern between the first occurrence of "// Create Lobby Button" and the next occurrence of "// Join Lobby Button" that contains the old markers
let cleaned = text;
let replaced = 0;

// Helper to replace a block that contains the old markers with the new socket-based block
function replaceOldBlock() {
  const startIdx = cleaned.indexOf('// Create Lobby Button');
  if (startIdx === -1) return false;
  const endIdx = cleaned.indexOf('// Generate random lobby code', startIdx);
  if (endIdx === -1) return false;
  const block = cleaned.slice(startIdx, endIdx);
  // If block contains emoji markers (old implementation), replace entire range with standard new block
  if (block.indexOf(oldCreateMarker) !== -1 || block.indexOf(oldJoinMarker) !== -1) {
    const newBlock = `// Create Lobby Button\n  createLobbyBtn.addEventListener('click', async function() {\n    const storedUser = localStorage.getItem('discordUser');\n    if (!storedUser) { alert('Bitte melde dich zuerst mit Discord an!'); return; }\n    const userData = JSON.parse(storedUser);\n    const localLobbyCode = generateLobbyCode();\n    lobbyCodeInput.value = localLobbyCode;\n    updateJoinButtonState();\n    const socket = window.__LMS_SOCKET;\n    if (socket && socket.connected) {\n      try {\n        socket.emit('create-lobby', { lobbyId: localLobbyCode, host: { id: userData.id, username: userData.username } }, (res) => {\n          console.log('[app] create-lobby ack', res);\n          if (res && (res.ok === true || res.lobbyId)) {\n            const finalCode = res.lobbyId || localLobbyCode;\n            try { localStorage.setItem('lobbyCode', finalCode); localStorage.setItem('isHost', 'true'); } catch(e){}\n            lobbyCodeInput.value = finalCode;\n            window.location.href = 'lobby.html?code=' + encodeURIComponent(finalCode);\n          } else {\n            alert('Erstellen der Lobby fehlgeschlagen: ' + (res && res.error ? res.error : 'Unbekannter Fehler'));\n            console.error('[app] create-lobby failed', res);\n          }\n        });\n      } catch (err) {\n        console.error('[app] Fehler beim Senden von create-lobby über Socket:', err);\n        try { localStorage.setItem('lobbyCode', localLobbyCode); localStorage.setItem('isHost', 'true'); } catch(e){}\n        window.location.href = 'lobby.html?code=' + encodeURIComponent(localLobbyCode);\n      }\n    } else {\n      try { localStorage.setItem('lobbyCode', localLobbyCode); localStorage.setItem('isHost', 'true'); } catch(e){}\n      window.location.href = 'lobby.html?code=' + encodeURIComponent(localLobbyCode);\n    }\n  });\n\n  // Join Lobby Button\n  joinLobbyBtn.addEventListener('click', function() {\n    if (!isLobbyCodeValid()) return;\n    const storedUser = localStorage.getItem('discordUser');\n    if (!storedUser) { alert('Bitte melde dich zuerst mit Discord an!'); return; }\n    const userData = JSON.parse(storedUser);\n    const code = lobbyCodeInput.value.trim();\n    const socket = window.__LMS_SOCKET;\n    if (socket && socket.connected) {\n      try {\n        socket.emit('join-lobby', { lobbyId: code, player: { id: userData.id, username: userData.username } }, (res) => {\n          console.log('[app] join-lobby ack', res);\n          if (res && res.ok) {\n            try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'false'); } catch(e){}\n            window.location.href = 'lobby.html?code=' + encodeURIComponent(code);\n          } else {\n            alert('Beitreten der Lobby fehlgeschlagen: ' + (res && res.error ? res.error : 'Lobby nicht gefunden oder geschlossen'));\n            console.error('[app] join-lobby failed', res);\n          }\n        });\n      } catch (err) {\n        console.error('[app] Fehler beim Senden von join-lobby über Socket:', err);\n        try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'false'); } catch(e){}\n        window.location.href = 'lobby.html?code=' + encodeURIComponent(code);\n      }\n    } else {\n      try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'false'); } catch(e){}\n      window.location.href = 'lobby.html?code=' + encodeURIComponent(code);\n    }\n  });\n`;
    cleaned = before + newBlock + after;
    replaced++;
    return true;
  }
  return false;
}

while (replaceOldBlock()) {}

if (replaced > 0) {
  fs.writeFileSync(filePath, cleaned, 'utf8');
  console.log('Replaced', replaced, 'old handler block(s).');
} else {
  console.log('No old handler blocks found to replace.');
}

