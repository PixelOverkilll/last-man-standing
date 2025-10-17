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
// Verwende zentrale P2PConnection-Klasse
let p2p = null;

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

// Zentrale Cleanup-Funktion: schließt alle Verbindungen und zerstört den Peer
function cleanupConnections() {
  try {
    // Schließe alle Client-Verbindungen
    if (connections && connections.size > 0) {
      for (const [id, c] of Array.from(connections.entries())) {
        try { c.close(); } catch (e) { /* ignore */ }
      }
      connections.clear();
    }

    // Schließe Host-Verbindung (Client-Seite)
    if (hostConnection) {
      try { hostConnection.close(); } catch (e) { /* ignore */ }
      hostConnection = null;
    }

    // Wenn eine zentrale P2P-Instanz existiert, nutze deren Cleanup
    if (p2p) {
      try { p2p.disconnectAll(); } catch (e) { console.warn('Fehler beim p2p.disconnectAll', e); }
      p2p = null;
    }

    // Zerstöre lokale Peer-Referenz (falls noch vorhanden)
    if (peer) {
      try { peer.destroy(); } catch (e) { /* ignore */ }
      peer = null;
    }

    // UI/State zurücksetzen
    players.clear();
    const playersContainer = document.getElementById('players-container');
    if (playersContainer) playersContainer.innerHTML = '';
    localStorage.removeItem('lobbyCode');
    localStorage.removeItem('isHost');
  } catch (e) {
    console.warn('Fehler beim Cleanup der Verbindungen', e);
  }
}

// Host erstellt Lobby
async function createLobby(code) {
  console.log('🎮 Erstelle P2P-Lobby als Host mit Code:', code);

  // Erzeuge P2PConnection und konfiguriere Event-Handler
  p2p = new P2PConnection();

  // Wenn ein Spieler beitritt, synchronisiere lokale Maps und UI
  p2p.onPlayerJoined = (player) => {
    // Map mit Connection-Objekt aus P2PConnection füllen
    const conn = p2p.connections.get(player.id);
    if (conn) connections.set(player.id, conn);
    players.set(player.id, player);
    addPlayerToDOM(player);
    showNotification(`✅ ${player.name} ist beigetreten`, 'success', 2000);
  };

  p2p.onPlayerLeft = (playerId) => {
    if (players.has(playerId)) {
      const player = players.get(playerId);
      removePlayerFromDOM(playerId);
      players.delete(playerId);
      connections.delete(playerId);
      showNotification(`❌ ${player.name} hat die Lobby verlassen`, 'info', 2000);
    }
  };

  p2p.onGameStateUpdate = (data) => {
    // Bei Host normalerweise nicht benötigt, aber forwarden
    handleMessage(data);
  };

  p2p.onMessageReceived = (type, data) => {
    // Leite generische Nachrichten an vorhandene Handler weiter
    handleMessage({ type, ...data });
  };

  // Erstelle Host-Player-Objekt
  const hostPlayer = {
    id: currentUser?.id || 'host_' + Date.now(),
    name: currentUser?.global_name || currentUser?.username || 'Host',
    avatar: getUserAvatar(currentUser),
    isHost: true
  };

  try {
    const id = await p2p.createLobby(hostPlayer);
    lobbyCode = id;
    localStorage.setItem('lobbyCode', lobbyCode);
    // Starte Heartbeat für Host
    p2p.startHeartbeat();
    return id;
  } catch (e) {
    throw e;
  }
}

// Spieler tritt Lobby bei
async function joinLobby(code) {
  console.log('🔗 Verbinde mit Lobby:', code);

  p2p = new P2PConnection();

  // Client event handlers
  p2p.onGameStateUpdate = (data) => {
    // Erhalte lobby-state vom Host
    handleMessage({ type: 'lobby-state', ...data });
  };

  p2p.onPlayerJoined = (player) => {
    if (!players.has(player.id)) {
      players.set(player.id, player);
      // Sync connection if available
      const conn = p2p.connections.get(player.id);
      if (conn) connections.set(player.id, conn);
      addPlayerToDOM(player);
    }
  };

  p2p.onPlayerLeft = (playerId) => {
    if (players.has(playerId)) {
      removePlayerFromDOM(playerId);
      players.delete(playerId);
      connections.delete(playerId);
    }
  };

  p2p.onMessageReceived = (type, data) => {
    handleMessage({ type, ...data });
  };

  const playerObj = {
    id: currentUser?.id || ('p_' + Date.now()),
    name: currentUser?.global_name || currentUser?.username,
    avatar: getUserAvatar(currentUser),
    score: 0,
    isHost: false
  };

  try {
    const conn = await p2p.joinLobby(code, playerObj);
    hostConnection = conn;
    return conn;
  } catch (e) {
    throw e;
  }
}

// Host: wird jetzt von P2PConnection intern behandelt; UI-Updates kommen über p2p.onPlayerJoined

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
    // Versuche die Verbindung zu schließen, damit der 'close'-Handler greift
    try {
      conn.close();
    } catch (e) {
      console.warn('Fehler beim Schließen der fehlerhaften Connection', e);
    }
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

        // F\u00fcge alle Spieler hinzu
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
      // Hier k\u00f6nnte das Quiz gestartet werden
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

  // Iteriere sicher und entferne geschlossene/verwaiste Conns
  for (const [playerId, conn] of Array.from(connections.entries())) {
    if (playerId === excludeId) continue;
    if (conn && conn.open) {
      try {
        conn.send(data);
      } catch (e) {
        console.warn('Fehler beim Senden an', playerId, e);
      }
    } else {
      // Entferne geschlossene Verbindungen aus der Map
      connections.delete(playerId);
      // Entferne auch DOM-Eintrag falls vorhanden
      removePlayerFromDOM(playerId);
      players.delete(playerId);
    }
  }
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

  const urlParams = new URLSearchParams(window.location.search);
  const urlLobbyCode = urlParams.get('code');

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
    sidebar.style.background = 'rgba(255,255,255,0.97)';
    sidebar.style.transition = 'border 0.2s, box-shadow 0.2s, background 0.2s';
    // Buttons: Umrandung beim Hover
    sidebar.querySelectorAll('.points-btn').forEach(btn => {
      btn.onmouseenter = () => {
        btn.style.borderColor = primaryColor;
        btn.style.boxShadow = `0 0 0 2px ${primaryColor}`;
      };
      btn.onmouseleave = () => {
        btn.style.borderColor = '#e5e7eb';
        btn.style.boxShadow = 'none';
      };
      btn.style.borderColor = '#e5e7eb';
      btn.style.background = '#fff';
      btn.style.color = '#222';
    });
  } else {
    sidebar.style.border = '4px solid #7c3aed';
    sidebar.style.boxShadow = '-8px 0 32px #7c3aed33';
    sidebar.style.background = 'rgba(255,255,255,0.97)';
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
}

function leaveLobby() {
  if (!confirm('Lobby wirklich verlassen?')) return;

  // Zentrales Cleanup durchführen
  cleanupConnections();

  showNotification('Lobby verlassen', 'info', 500);
  setTimeout(() => window.location.href = 'index.html', 500);
}

// Wenn Host-Lobby aktiv, starte Heartbeat
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cleanupConnections();
  });
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

console.log('✅ Lobby System MIT P2P geladen!');
