// ========================================
// LOBBY SYSTEM - MIT PEER-TO-PEER
// ========================================

console.log('🎮 Lobby System mit P2P lädt...');

// Globale Variablen
let isHost = false;
let lobbyCode = '';
let currentUser = null;
let players = new Map(); // playerId -> playerData
let peer = null;
let connections = new Map(); // playerId -> connection
let hostConnection = null;
let selectedPlayerId = null;

// ========================================
// FARBEXTRAKTION FÜR AVATARE
// ========================================
function extractDominantColor(imageUrl, callback) {
  const img = new Image();
  img.crossOrigin = 'Anonymous';

  img.onload = function() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let r = 0, g = 0, b = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 40) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }

    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);

    const hsl = rgbToHsl(r, g, b);

    let targetHue = hsl[0];
    const purpleHue = 0.75;

    let hueDiff = Math.abs(targetHue - purpleHue);
    if (hueDiff > 0.5) hueDiff = 1 - hueDiff;

    if (hueDiff > 0.15) {
      targetHue = purpleHue * 0.7 + targetHue * 0.3;
    }

    hsl[1] = Math.min(hsl[1] * 1.8, 0.9);
    hsl[2] = Math.max(0.45, Math.min(hsl[2], 0.65));

    const rgb = hslToRgb(targetHue, hsl[1], hsl[2]);
    const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

    callback(color);
  };

  img.onerror = function() {
    callback('#7c3aed');
  };

  img.src = imageUrl;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function applyPlayerColor(playerCard, color) {
  const rgb = color.match(/\d+/g).map(Number);

  // Setze CSS-Variablen für Avatar-Farbe
  playerCard.style.setProperty('--avatar-color', color);
  playerCard.style.setProperty('--avatar-rgb', `${rgb[0]},${rgb[1]},${rgb[2]}`);

  playerCard.style.borderColor = color;
  playerCard.style.boxShadow = `0 15px 40px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.8)`;

  const avatar = playerCard.querySelector('.player-avatar');
  if (avatar) {
    avatar.style.borderColor = color;
    avatar.style.boxShadow = `0 0 25px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`;
  }

  // Punkte-Leiste nutzt jetzt CSS-Variable, keine direkte Style-Zuweisung mehr
  // const scoreElement = playerCard.querySelector('.player-score');
  // if (scoreElement) {
  //   scoreElement.style.borderColor = color;
  //   scoreElement.style.backgroundColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
  // }
}

// ========================================
// P2P FUNKTIONEN
// ========================================

// Host erstellt Lobby
async function createLobby(code) {
  console.log('🎮 Erstelle P2P-Lobby als Host mit Code:', code);

  return new Promise((resolve, reject) => {
    // Erstelle Peer mit dem übergebenen Lobby-Code als ID
    peer = new Peer(code, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('open', (id) => {
      console.log('✅ P2P-Lobby erstellt mit Code:', id);
      lobbyCode = id;

      // Host wird NICHT als Spieler hinzugefügt, nur als Host-Info gespeichert
      console.log('👑 Host bereit, warte auf Spieler...');

      resolve(id);
    });

    peer.on('error', (error) => {
      console.error('❌ Peer Error:', error);
      showNotification('❌ Verbindungsfehler: ' + error.type, 'error', 3000);
      reject(error);
    });

    // Lausche auf eingehende Verbindungen
    peer.on('connection', (conn) => {
      console.log('👥 Eingehende Verbindung von:', conn.peer);
      handleIncomingConnection(conn);
    });
  });
}

// Spieler tritt Lobby bei
async function joinLobby(code) {
  console.log('🔗 Verbinde mit Lobby:', code);

  return new Promise((resolve, reject) => {
    // Erstelle Peer mit zufälliger ID
    peer = new Peer({
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('open', (id) => {
      console.log('🔗 Peer erstellt mit ID:', id);

      // Verbinde mit Host
      const conn = peer.connect(code, {
        reliable: true,
        metadata: {
          player: {
            id: id,
            name: currentUser.global_name || currentUser.username,
            avatar: getUserAvatar(currentUser),
            score: 0,
            isHost: false
          }
        }
      });

      setupConnection(conn, true);
      hostConnection = conn;

      conn.on('open', () => {
        console.log('✅ Verbindung zum Host hergestellt');
        showNotification('✅ Mit Lobby verbunden!', 'success', 2000);
        resolve(conn);
      });

      conn.on('error', (error) => {
        console.error('❌ Verbindungsfehler:', error);
        showNotification('❌ Verbindung fehlgeschlagen', 'error', 3000);
        reject(error);
      });
    });

    peer.on('error', (error) => {
      console.error('❌ Peer Error:', error);
      showNotification('❌ Lobby nicht gefunden', 'error', 3000);
      reject(error);
    });
  });
}

// Host: Eingehende Verbindung behandeln
function handleIncomingConnection(conn) {
  console.log('👤 Neuer Spieler verbindet sich:', conn.peer);

  setupConnection(conn, false);

  conn.on('open', () => {
    console.log('✅ Verbindung geöffnet mit:', conn.peer);

    const player = conn.metadata?.player || {
      id: conn.peer,
      name: 'Spieler_' + conn.peer.substring(0, 4),
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + conn.peer,
      score: 0,
      isHost: false
    };

    console.log('➕ Füge Spieler hinzu:', player);

    connections.set(player.id, conn);
    players.set(player.id, player);

    // Spieler zur DOM hinzufügen
    addPlayerToDOM(player);

    // Sende aktuelle Lobby-Daten an neuen Spieler
    setTimeout(() => {
      console.log('📤 Sende Lobby-State an:', player.name);
      conn.send({
        type: 'lobby-state',
        host: {
          name: currentUser.global_name || currentUser.username,
          avatar: getUserAvatar(currentUser)
        },
        players: Array.from(players.values())
      });
    }, 500);

    // Benachrichtige alle anderen über den neuen Spieler
    broadcast({
      type: 'player-joined',
      player: player
    }, player.id);

    showNotification(`✅ ${player.name} ist beigetreten`, 'success', 2000);
  });
}

// Verbindungs-Events einrichten
function setupConnection(conn, isToHost) {
  conn.on('data', (data) => {
    handleMessage(data, conn);
  });

  conn.on('close', () => {
    console.log('🔌 Verbindung geschlossen:', conn.peer);
    handleDisconnect(conn);
  });

  conn.on('error', (error) => {
    console.error('❌ Connection Error:', error);
  });
}

// Nachricht verarbeiten
function handleMessage(data, conn) {
  console.log('\ud83d\udce8 Nachricht empfangen:', data.type);

  switch (data.type) {
    case 'lobby-state':
      // Empfange Lobby-Status vom Host
      if (!isHost) {
        const host = data.host;
        displayHostInfo(host);

        // Füge alle Spieler hinzu
        data.players.forEach(player => {
          if (!players.has(player.id)) {
            players.set(player.id, player);
            addPlayerToDOM(player);
          }
        });
      }
      break;

    case 'player-joined':
      if (!players.has(data.player.id)) {
        players.set(data.player.id, data.player);
        addPlayerToDOM(data.player);
        showNotification(`\u2705 ${data.player.name} ist beigetreten`, 'success', 2000);
      }
      break;

    case 'player-left':
      if (players.has(data.playerId)) {
        const player = players.get(data.playerId);
        removePlayerFromDOM(data.playerId);
        players.delete(data.playerId);
        showNotification(`\u274c ${player.name} hat die Lobby verlassen`, 'info', 2000);
      }
      break;

    case 'score-update':
      // Aktualisiere Punktestand, wenn ein Host diesen geaendert hat
      if (data && data.playerId) {
        const p = players.get(data.playerId) || null;
        if (p) {
          p.score = data.score;
          players.set(data.playerId, p);
          updatePlayerScoreInDOM(data.playerId, data.score);
          showNotification(`\u2705 ${p.name} hat jetzt ${data.score} Punkte`, 'success', 1500);
        } else {
          // Falls Spieler noch nicht vorhanden, lege ihn kurz an (sicherheitsfall)
          const newP = { id: data.playerId, name: data.name || 'Spieler', avatar: data.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + data.playerId, score: data.score };
          players.set(data.playerId, newP);
          addPlayerToDOM(newP);
          showNotification(`\u2705 ${newP.name} hat jetzt ${data.score} Punkte`, 'success', 1500);
        }
      }
      break;

    case 'game-start':
      showNotification('\ud83c\udfae Quiz startet!', 'success', 2000);
      // Hier könnte das Quiz gestartet werden
      break;

    case 'screen-flash':
      // Neue Nachricht: Bildschirm-Flash synchronisieren
      if (data && data.color) {
        try {
          const duration = Number(data.duration) || 700;
          triggerScreenFlash(data.color, duration);
        } catch (e) {
          console.warn('Fehler beim Ausführen des screen-flash Events:', e);
        }
      }
      break;
  }
}

// Verbindung getrennt
function handleDisconnect(conn) {
  if (isHost) {
    // Host: Entferne Spieler
    let disconnectedPlayerId = null;
    connections.forEach((c, id) => {
      if (c === conn) disconnectedPlayerId = id;
    });

    if (disconnectedPlayerId) {
      connections.delete(disconnectedPlayerId);
      const player = players.get(disconnectedPlayerId);

      if (player) {
        removePlayerFromDOM(disconnectedPlayerId);
        players.delete(disconnectedPlayerId);

        // Benachrichtige andere Spieler
        broadcast({
          type: 'player-left',
          playerId: disconnectedPlayerId
        });

        showNotification(`❌ ${player.name} hat die Lobby verlassen`, 'info', 2000);
      }
    }
  } else {
    // Spieler: Host getrennt
    showNotification('❌ Verbindung zum Host verloren', 'error', 3000);
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 3000);
  }
}

// Nachricht an alle Spieler senden (Host)
function broadcast(data, excludeId = null) {
  if (!isHost) return;

  connections.forEach((conn, playerId) => {
    if (playerId !== excludeId && conn.open) {
      conn.send(data);
    }
  });
}

// Nachricht an Host senden (Spieler)
function sendToHost(data) {
  if (isHost || !hostConnection) return;

  if (hostConnection.open) {
    hostConnection.send(data);
  }
}

// Lobby-Code generieren
function generateLobbyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ========================================
// INITIALISIERUNG
// ========================================
document.addEventListener('DOMContentLoaded', async function() {
  console.log('✅ DOM geladen');

  // Entferne ggf. alte Inline-Stile von einer bereits existierenden Punkte-Sidebar
  cleanupPointsSidebarInlineStyles();

  const urlParams = new URLSearchParams(window.location.search);
  let urlLobbyCode = urlParams.get('code');

  // Test-Fallback: wenn ?forceHost=1 oder ?forceHost=true gesetzt ist, setze localStorage.isHost (nur für Debug/Test)
  const forceHost = urlParams.get('forceHost') === '1' || urlParams.get('forceHost') === 'true';
  if (forceHost) {
    console.log('🛠️ forceHost detected in URL, enabling host UI for testing');
    localStorage.setItem('isHost', 'true');
  }

  // Debug-Fallback: falls forceHost gesetzt wurde und kein Discord-User vorhanden ist, lege einen Dummy-User an (nur für lokale Tests)
  if (forceHost && !localStorage.getItem('discordUser')) {
    const debugUser = {
      id: 'debug-host',
      username: 'HostDebug',
      discriminator: '0001',
      avatar: null,
      global_name: 'HostDebug'
    };
    localStorage.setItem('discordUser', JSON.stringify(debugUser));
    console.log('🛠️ Debug Discord user created for testing (localStorage.discordUser)');
  }

  // Wenn forceHost gesetzt ist, aber kein code in der URL, setze einen Test-Lobby-Code damit die Lobby-UI nicht abbricht
  if (forceHost && !urlLobbyCode) {
    urlLobbyCode = 'TEST';
    localStorage.setItem('lobbyCode', urlLobbyCode);
    console.log('🛠️ forceHost: no code in URL, using test lobby code:', urlLobbyCode);
  }

  const storedLobbyCode = localStorage.getItem('lobbyCode');
  const storedIsHost = localStorage.getItem('isHost');

  console.log('🔍 URL Lobby Code:', urlLobbyCode);
  console.log('🔍 Stored Lobby Code:', storedLobbyCode);
  console.log('🔍 Stored isHost:', storedIsHost);

  // Lade User
  if (!loadCurrentUser()) {
    console.error('❌ Kein User gefunden - zurück zur Startseite');
    showNotification('❌ Bitte melde dich zuerst an!', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
    return;
  }

  // Bestimme ob Host oder Client
  if (storedIsHost === 'true' && urlLobbyCode) {
    isHost = true;
    lobbyCode = urlLobbyCode;
  } else if (urlLobbyCode && storedIsHost !== 'true') {
    isHost = false;
    lobbyCode = urlLobbyCode;
  } else {
    console.error('❌ Ungültige Lobby-Parameter');
    showNotification('❌ Ungültige Lobby-Parameter', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
    return;
  }

  console.log('🎯 isHost:', isHost);
  console.log('🎯 lobbyCode:', lobbyCode);

  // --- NEU: Anwenden des gespeicherten Hintergrunds in der Lobby ---
  applySavedBackground();

  // Reagiere auf Änderungen in localStorage (z.B. anderes Tab ändert Auswahl)
  window.addEventListener('storage', (evt) => {
    if (evt.key === 'backgroundStyle') {
      applySavedBackground();
    }
  });

  // Initialisiere UI
  initUI();
  setupEventListeners();

  // Starte P2P-Verbindung
  try {
    if (isHost) {
      // Host verwendet den Code aus der URL
      await createLobby(lobbyCode);
      displayHostInfo();
      showNotification('✅ Lobby erstellt! Code: ' + lobbyCode, 'success', 3000);
      localStorage.setItem('lobbyCode', lobbyCode);
      console.log('✅ Host-Lobby bereit. Warte auf Spieler...');
    } else {
      console.log('🔗 Versuche Lobby beizutreten:', lobbyCode);
      await joinLobby(lobbyCode);
      console.log('✅ Client erfolgreich verbunden');
    }
  } catch (error) {
    console.error('❌ P2P-Verbindung fehlgeschlagen:', error);
    showNotification('❌ Verbindung fehlgeschlagen', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
  }
});

// Entfernt Inline-Styles von bestehender Punkte-Sidebar/Buttons, falls sie durch ältere JS-Versionen gesetzt wurden
function cleanupPointsSidebarInlineStyles() {
  try {
    const sidebar = document.getElementById('points-sidebar');
    if (!sidebar) return;
    // Entferne Inline-Styles, damit CSS wieder gilt
    sidebar.style.background = '';
    sidebar.style.border = '';
    sidebar.style.boxShadow = '';
    sidebar.style.display = '';

    sidebar.querySelectorAll('.points-btn').forEach(btn => {
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
      btn.style.boxShadow = '';
    });

    // Falls there is a cancel button too
    const cancel = sidebar.querySelector('.points-cancel-btn');
    if (cancel) {
      cancel.style.background = '';
      cancel.style.color = '';
    }
  } catch (e) {
    console.warn('Fehler beim Aufräumen der Punkte-Sidebar Inline-Styles:', e);
  }
}

// ========================================
// DOM FUNKTIONEN
// ========================================
function addPlayerToDOM(player) {
  // Pr\u00fcfe ob Spieler bereits existiert
  if (document.getElementById('player-' + player.id)) {
    console.log('\u26a0\ufe0f Spieler bereits in DOM:', player.name);
    return;
  }

  const container = document.getElementById('players-container');
  const card = document.createElement('div');
  card.className = 'player-card';
  card.id = 'player-' + player.id;
  card.innerHTML = `
    <img src="${player.avatar}" alt="${player.name}" class="player-avatar">
    <span class="player-name">${player.name}${player.isHost ? ' \ud83d\udc51' : ''}</span>
    <span class="player-score">${player.score} Punkte</span>
  `;

  container.appendChild(card);

  extractDominantColor(player.avatar, (color) => {
    applyPlayerColor(card, color);
  });

  // Host kann Spieler auswählen (Klick auf Karte)
  card.addEventListener('click', () => {
    if (!isHost) return;
    selectPlayerForPoints(player.id);
  });

  console.log('\u2795 Spieler zur DOM hinzugef\u00fcgt:', player.name);
}

function removePlayerFromDOM(playerId) {
  const card = document.getElementById('player-' + playerId);
  if (card) {
    card.remove();
    console.log('\u2796 Spieler aus DOM entfernt:', playerId);
  }
}

// Aktualisiert die Anzeige des Punktestands im DOM
function updatePlayerScoreInDOM(playerId, score) {
  const card = document.getElementById('player-' + playerId);
  if (!card) return;
  const scoreElement = card.querySelector('.player-score');
  if (scoreElement) {
    scoreElement.textContent = `${score} Punkte`;
    // kurzer visueller Effekt
    scoreElement.style.transition = 'transform 0.15s ease, background-color 0.25s ease';
    scoreElement.style.transform = 'scale(1.05)';
    setTimeout(() => { scoreElement.style.transform = ''; }, 150);
  }
}

// Host-Funktion: interaktives Prompt, um Punkte zu geben
function handleGivePoints(playerId) {
  const player = players.get(playerId);
  if (!player) {
    showNotification('\u26a0\ufe0f Spieler nicht gefunden', 'error', 1500);
    return;
  }

  const input = prompt(`Punkte f\u00fcr ${player.name} hinzuf\u00fcgen (z.B. 1 oder -1 für abziehen):`, '1');
  if (input === null) return; // abgebrochen

  const value = parseInt(input, 10);
  if (isNaN(value)) {
    showNotification('\u274c Ung\u00fcltige Zahl', 'error', 1500);
    return;
  }

  awardPoints(playerId, value);
}

function selectPlayerForPoints(playerId) {
  // Entferne alte Markierung
  document.querySelectorAll('.player-card.selected-player').forEach(card => {
    card.classList.remove('selected-player');
  });
  selectedPlayerId = playerId;
  const card = document.getElementById('player-' + playerId);
  if (card) {
    card.classList.add('selected-player');
  }
  // Avatar-Farbe berechnen und an Sidebar übergeben
  const player = players.get(playerId);
  if (player) {
    extractDominantColor(player.avatar, (color) => {
      showPointsSidebar(color);
    });
  } else {
    showPointsSidebar();
  }
}

function showPointsSidebar(primaryColor) {
  let sidebar = document.getElementById('points-sidebar');
  if (!sidebar) {
    sidebar = document.createElement('div');
    sidebar.id = 'points-sidebar';
    sidebar.className = 'points-sidebar';
    sidebar.innerHTML = `
      <div class="points-sidebar-title">Punkte vergeben</div>
      <div class="points-btn-list">
        ${[10, 20, 30, 40, 50].map(val => `<button class='points-btn' data-points='${val}'>${val}</button>`).join('')}
      </div>
      <button class="points-cancel-btn">Abbrechen</button>
    `;
    document.body.appendChild(sidebar);
    sidebar.addEventListener('click', (e) => {
      if (e.target.classList.contains('points-btn')) {
        const val = parseInt(e.target.getAttribute('data-points'), 10);
        if (selectedPlayerId) {
          awardPoints(selectedPlayerId, val);
          // hidePointsSidebar(); // Entfernt: Leiste bleibt offen
        }
      }
      if (e.target.classList.contains('points-cancel-btn')) {
        hidePointsSidebar();
      }
    });
  }
  // Setze die Primärfarbe als Umrandung/Schatten
  if (primaryColor) {
    sidebar.style.border = `4px solid ${primaryColor}`;
    sidebar.style.boxShadow = `-8px 0 32px ${primaryColor}33`;
    // Keine weiße Hintergrund-Erzwungung mehr, damit das CSS die Optik übernehmen kann
    sidebar.style.background = 'rgba(30,15,45,0.95)';
    sidebar.style.transition = 'border 0.2s, box-shadow 0.2s, background 0.2s';
    // Buttons: nur Hover-Umrandung/Schatten per JS (keine statische weiße Hintergrundfarbe mehr)
    sidebar.querySelectorAll('.points-btn').forEach(btn => {
      btn.onmouseenter = () => {
        btn.style.borderColor = primaryColor;
        btn.style.boxShadow = `0 0 0 4px ${primaryColor}33, 0 6px 20px rgba(60,0,80,0.22)`;
        btn.style.color = '#fff';
      };
      btn.onmouseleave = () => {
        // Entferne die Inline-Styles, damit die CSS-Regeln wieder sichtbar werden
        btn.style.borderColor = '';
        btn.style.boxShadow = '';
        btn.style.color = '';
      };
      // Entferne vorher gesetzte Inline-Styles, die Buttons weiß machten
      btn.style.borderColor = '';
      btn.style.background = '';
      btn.style.color = '';
    });
  } else {
    sidebar.style.border = '4px solid #7c3aed';
    sidebar.style.boxShadow = '-8px 0 32px #7c3aed33';
    // Keine weiße Hintergrund-Erzwungung hier
    sidebar.style.background = '';
  }
  sidebar.style.display = 'block';
}

function hidePointsSidebar() {
  const sidebar = document.getElementById('points-sidebar');
  if (sidebar) sidebar.style.display = 'none';
  // Markierung entfernen
  document.querySelectorAll('.player-card.selected-player').forEach(card => {
    card.classList.remove('selected-player');
  });
  selectedPlayerId = null;
}

// Host-Funktion: Punkte vergeben und an Clients broadcasten
function awardPoints(playerId, delta) {
  if (!isHost) return;
  const player = players.get(playerId);
  if (!player) return;

  player.score = (player.score || 0) + Number(delta);
  players.set(playerId, player);

  // Update DOM lokal
  updatePlayerScoreInDOM(playerId, player.score);

  // Broadcast an alle Clients
  broadcast({
    type: 'score-update',
    playerId: playerId,
    score: player.score,
    name: player.name,
    avatar: player.avatar
  });

  showNotification(`\u2705 ${player.name} erh\u00e4lt ${delta > 0 ? '+' + delta : delta} Punkte (insg. ${player.score})`, 'success', 1800);
  // hidePointsSidebar(); // Entfernt: Leiste bleibt offen
}

// ========================================
// HELPER FUNKTIONEN
// ========================================
function loadCurrentUser() {
  const storedUser = localStorage.getItem('discordUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    console.log('👤 User geladen:', currentUser.username || currentUser.global_name);
    return true;
  }
  return false;
}

function displayHostInfo(hostData) {
  const hostAvatar = document.getElementById('host-avatar');
  const hostName = document.getElementById('host-name');

  if (!hostAvatar || !hostName) return;

  if (hostData) {
    hostAvatar.src = hostData.avatar;
    hostName.textContent = hostData.name;
  } else if (currentUser && isHost) {
    hostAvatar.src = getUserAvatar(currentUser);
    hostName.textContent = currentUser.global_name || currentUser.username;
  }
}

function getUserAvatar(user) {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  } else {
    const discriminator = parseInt(user.discriminator || '0') % 5;
    return `https://cdn.discordapp.com/embed/avatars/${discriminator}.png`;
  }
}

function initUI() {
  const lobbyCodeDisplay = document.getElementById('lobby-code-display');
  const lobbyCodeContainer = document.getElementById('lobby-code-container');
  const hostControls = document.getElementById('host-controls');

  if (lobbyCodeDisplay) {
    lobbyCodeDisplay.textContent = lobbyCode;
  }

  if (isHost) {
    if (lobbyCodeContainer) lobbyCodeContainer.style.display = 'flex';
    if (hostControls) hostControls.style.display = 'block';
  } else {
    if (lobbyCodeContainer) lobbyCodeContainer.style.display = 'none';
    if (hostControls) hostControls.style.display = 'none';
  }
}

function setupEventListeners() {
  const startBtn = document.getElementById('start-quiz-btn');
  if (startBtn && isHost) {
    startBtn.addEventListener('click', startQuiz);
  }

  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

  const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
  if (leaveLobbyBtn) leaveLobbyBtn.addEventListener('click', leaveLobby);

  // Neue Host-Bewertungs-Buttons (Richtig / Falsch)
  const btnCorrect = document.getElementById('btn-correct');
  const btnIncorrect = document.getElementById('btn-incorrect');

  if (btnCorrect) {
    btnCorrect.addEventListener('click', () => {
      if (!isHost) return;
      const color = 'rgba(34,197,94,0.92)'; // grün
      const duration = 700;
      // Lokaler Flash für Host
      triggerScreenFlash(color, duration);
      // Broadcast an alle Clients
      broadcast({ type: 'screen-flash', color, duration });
      console.log('📣 Host sendet screen-flash (correct)');
    });
  }

  if (btnIncorrect) {
    btnIncorrect.addEventListener('click', () => {
      if (!isHost) return;
      const color = 'rgba(239,68,68,0.92)'; // rot
      const duration = 700;
      triggerScreenFlash(color, duration);
      broadcast({ type: 'screen-flash', color, duration });
      console.log('📣 Host sendet screen-flash (incorrect)');
    });
  }
}

function leaveLobby() {
  if (!confirm('Lobby wirklich verlassen?')) return;

  // Verbindungen schließen
  if (isHost) {
    connections.forEach((conn) => conn.close());
    connections.clear();
  } else if (hostConnection) {
    hostConnection.close();
  }

  if (peer) {
    peer.destroy();
  }

  localStorage.removeItem('lobbyCode');
  localStorage.removeItem('isHost');

  showNotification('Lobby verlassen', 'info', 500);
  setTimeout(() => window.location.href = 'index.html', 500);
}

function startQuiz() {
  if (players.size < 1) {
    showNotification('⚠️ Mindestens 1 Spieler benötigt', 'error', 2000);
    return;
  }

  showNotification('🎮 Quiz startet!', 'success', 2000);

  // Sende Start-Signal an alle Spieler
  broadcast({
    type: 'game-start',
    timestamp: Date.now()
  });

  console.log('🎮 Quiz gestartet mit', players.size, 'Spielern');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Fullscreen fehlgeschlagen:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

function showNotification(message, type = 'info', duration = 2000) {
  const notification = document.createElement('div');
  notification.textContent = message;

  const colors = {
    success: 'rgba(16, 185, 129, 0.95)',
    error: 'rgba(239, 68, 68, 0.95)',
    info: 'rgba(124, 58, 237, 0.95)'
  };

  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 12px 20px;
    border-radius: 10px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
    z-index: 200;
    font-weight: 600;
    font-size: 0.9rem;
    animation: slideIn 0.2s ease-out;
    max-width: 250px;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(400px)';
    notification.style.transition = 'all 0.2s ease-out';
    setTimeout(() => notification.remove(), 200);
  }, duration);
}

// CSS Animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(300px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;
document.head.appendChild(style);

// Neue Hilfsfunktion: wendet die gespeicherte Hintergrundklasse an
function applySavedBackground() {
  try {
    const bgType = localStorage.getItem('backgroundStyle') || 'checkerboard';

    // Entferne mögliche Klassen
    document.body.classList.remove('bg-checkerboard', 'bg-gradient', 'bg-dots', 'bg-waves');

    // Wenn checkerboard, lasse body ohne extra-Klasse (oder setze bg-checkerboard explizit)
    if (bgType && bgType !== 'checkerboard') {
      document.body.classList.add('bg-' + bgType);
      console.log('🎨 Lobby Hintergrund gesetzt auf:', bgType);
    } else {
      // Optional: explizit setzen, damit das Styling konsistent ist
      document.body.classList.add('bg-checkerboard');
      console.log('🎨 Lobby Hintergrund gesetzt auf: checkerboard (default)');
    }
  } catch (e) {
    console.error('❌ Fehler beim Anwenden des Hintergrunds:', e);
  }
}

// Screen Flash Helper: erstellt/holt Overlay und spielt kurzen Farb-Flash ab
function getOrCreateScreenOverlay() {
  let overlay = document.getElementById('screen-flash-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'screen-flash-overlay';
    overlay.className = 'screen-flash';
    // Default hidden
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);
  }
  return overlay;
}

function triggerScreenFlash(color = 'rgba(124,58,237,0.9)', duration = 700) {
  try {
    const overlay = getOrCreateScreenOverlay();
    // Setze die Hintergrundfarbe (inkl. Alpha)
    overlay.style.background = color;

    // Force a reflow to ensure transition runs even if color is the same
    void overlay.offsetWidth;

    overlay.classList.add('show');

    // Entferne nach duration + fadeOut (transition 250ms)
    const total = Number(duration) || 700;
    setTimeout(() => {
      overlay.classList.remove('show');
      // leave overlay in DOM for reuse
    }, total);
  } catch (e) {
    console.error('Fehler beim triggerScreenFlash:', e);
  }
}

console.log('✅ Lobby System MIT P2P geladen!');
