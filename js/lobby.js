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

// Neue Hilfsfunktion: räumt vorhandene Peer-Instanzen und Verbindungen sauber auf
function cleanupPeer() {
  try {
    console.log('🧹 Aufräumen: vorhandene Peer/Verbindungen schließen (falls vorhanden)');

    // Schließe Verbindungsobjekt zum Host
    if (hostConnection) {
      try {
        if (hostConnection.open) hostConnection.close();
      } catch (e) {
        console.warn('Warnung beim Schließen von hostConnection:', e);
      }

      // Versuche zusätzlich das zugrunde liegende RTCPeerConnection-Objekt zu schließen
      try {
        if (hostConnection._pc && typeof hostConnection._pc.close === 'function') hostConnection._pc.close();
        if (hostConnection.peerConnection && typeof hostConnection.peerConnection.close === 'function') hostConnection.peerConnection.close();
        if (hostConnection._negotiator && hostConnection._negotiator._pc && typeof hostConnection._negotiator._pc.close === 'function') hostConnection._negotiator._pc.close();
      } catch (e) {
        /* ignore */
      }

      hostConnection = null;
    }

    // Schließe alle Client-Verbindungen
    if (connections && connections.size) {
      connections.forEach((c) => {
        try {
          if (c && c.open) c.close();
        } catch (e) {
          console.warn('Warnung beim Schließen einer Verbindung:', e);
        }

        // Versuche zusätzlich das zugrunde liegende RTCPeerConnection-Objekt zu schließen
        try {
          if (c && c._pc && typeof c._pc.close === 'function') c._pc.close();
          if (c && c.peerConnection && typeof c.peerConnection.close === 'function') c.peerConnection.close();
          if (c && c._negotiator && c._negotiator._pc && typeof c._negotiator._pc.close === 'function') c._negotiator._pc.close();
        } catch (e) {
          /* ignore */
        }
      });
      connections.clear();
    }

    // Zerstöre/Trenne den Peer selbst
    if (peer) {
      try {
        // Entferne alle Event-Listener, wenn unterstützt
        if (typeof peer.removeAllListeners === 'function') {
          try { peer.removeAllListeners(); } catch (e) { /* ignore */ }
        }

        // Versuche zuerst eine saubere Trennung
        try { if (typeof peer.disconnect === 'function') peer.disconnect(); } catch (e) { /* ignore */ }

        // Versuche zusätzlich alle intern gehaltenen DataConnections zu schließen (PeerJS intern pflegt peer.connections)
        try {
          if (peer.connections) {
            Object.keys(peer.connections).forEach(key => {
              const arr = peer.connections[key] || [];
              arr.forEach(dconn => {
                try {
                  if (dconn && typeof dconn.close === 'function') dconn.close();
                } catch (e) { /* ignore */ }
                try {
                  if (dconn && dconn._pc && typeof dconn._pc.close === 'function') dconn._pc.close();
                  if (dconn && dconn.peerConnection && typeof dconn.peerConnection.close === 'function') dconn.peerConnection.close();
                  if (dconn && dconn._negotiator && dconn._negotiator._pc && typeof dconn._negotiator._pc.close === 'function') dconn._negotiator._pc.close();
                } catch (e) { /* ignore */ }
              });
            });
          }
        } catch (e) { /* ignore */ }

        // Zwinge Zerstörung
        try { if (typeof peer.destroy === 'function') peer.destroy(); } catch (e) { /* ignore */ }
      } catch (e) {
        console.warn('Warnung beim Zerstören des Peers:', e);
      }
      peer = null;
    }
  } catch (e) {
    console.error('Fehler beim Aufräumen von Peer/Verbindungen:', e);
  }
}

// Host erstellt Lobby
async function createLobby(code) {
  console.log('🎮 Erstelle P2P-Lobby als Host mit Code:', code);

  // Stelle sicher, dass alte Peer/Verbindungen geschlossen sind
  cleanupPeer();

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

  // Stelle sicher, dass alte Peer/Verbindungen geschlossen sind
  cleanupPeer();

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
    case 'eval':
      // Host hat eine Bewertung (richtig/falsch) gesendet -> zeige Overlay an
      if (!isHost) {
        const result = data.result || 'correct';
        if (result === 'correct') {
          showEvalOverlay('rgba(57, 255, 20, 0.3)', data.duration || 300);
        } else {
          showEvalOverlay('rgba(255, 0, 0, 0.3)', data.duration || 300);
        }
      }
      break;
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
    sidebar.style.background = 'linear-gradient(135deg, #2d0a4b 80%, #7c3aed 100%)';
    sidebar.style.transition = 'border 0.2s, box-shadow 0.2s, background 0.2s';
    // Buttons: Umrandung beim Hover
    sidebar.querySelectorAll('.points-btn').forEach(btn => {
      btn.onmouseenter = () => {
        btn.style.borderColor = primaryColor;
        btn.style.boxShadow = `0 0 0 2px ${primaryColor}`;
      };
      btn.onmouseleave = () => {
        btn.style.borderColor = 'rgba(255,255,255,0.12)';
        btn.style.boxShadow = 'none';
      };
      btn.style.borderColor = 'rgba(255,255,255,0.12)';
      btn.style.background = 'linear-gradient(135deg, #8b27c4 60%, #7c3aed 100%)';
      btn.style.color = '#fff';
    });
  } else {
    sidebar.style.border = '4px solid #7c3aed';
    sidebar.style.boxShadow = '-8px 0 32px #7c3aed33';
    sidebar.style.background = 'linear-gradient(135deg, #2d0a4b 80%, #7c3aed 100%)';
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
  const hostEvalButtons = document.getElementById('host-eval-buttons');

  if (lobbyCodeDisplay) {
    lobbyCodeDisplay.textContent = lobbyCode;
  }

  if (isHost) {
    if (lobbyCodeContainer) lobbyCodeContainer.style.display = 'flex';
    if (hostControls) hostControls.style.display = 'block';
    if (hostEvalButtons) {
      hostEvalButtons.style.display = 'flex';
      hostEvalButtons.setAttribute('aria-hidden', 'false');
    }
  } else {
    if (lobbyCodeContainer) lobbyCodeContainer.style.display = 'none';
    if (hostControls) hostControls.style.display = 'none';
    if (hostEvalButtons) {
      hostEvalButtons.style.display = 'none';
      hostEvalButtons.setAttribute('aria-hidden', 'true');
    }
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

  const correctBtn = document.querySelector('.btn-correct');
  if (correctBtn && isHost) {
    correctBtn.addEventListener('click', () => {
      // Zeige lokal Overlay
      showEvalOverlay('rgba(57, 255, 20, 0.3)', 300);
      // Broadcast an alle Clients
      broadcast({ type: 'eval', result: 'correct', timestamp: Date.now(), duration: 300 });
    });
  }

  const wrongBtn = document.querySelector('.btn-wrong');
  if (wrongBtn && isHost) {
    wrongBtn.addEventListener('click', () => {
      // Zeige lokal Overlay
      showEvalOverlay('rgba(255, 0, 0, 0.3)', 300);
      // Broadcast an alle Clients
      broadcast({ type: 'eval', result: 'wrong', timestamp: Date.now(), duration: 300 });
    });
  }
}

// Helper: zeige eval-Overlay (wiederverwendet für Host & Clients)
function showEvalOverlay(bgColor = 'rgba(57, 255, 20, 0.3)', duration = 300) {
  try {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = bgColor;
    overlay.style.zIndex = '1000';
    overlay.style.pointerEvents = 'none';
    overlay.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }, duration);
  } catch (e) {
    console.error('Fehler beim Anzeigen des Eval-Overlays:', e);
  }
}

function leaveLobby() {
  if (!confirm('Lobby wirklich verlassen?')) return;

  // Verbindungen schließen
  // Nutze cleanupPeer() das alle Verbindungen und den Peer selbst sauber aufräumt
  cleanupPeer();

  localStorage.removeItem('lobbyCode');
  localStorage.removeItem('isHost');

  showNotification('Lobby verlassen', 'info', 500);
  setTimeout(() => window.location.href = 'index.html', 500);
}

// Stelle sicher, dass beim Schließen/Neuladen der Seite die Peer-Verbindungen geschlossen werden
window.addEventListener('beforeunload', function() {
  try {
    cleanupPeer();
  } catch (e) {
    console.warn('Fehler beim Aufräumen vor dem Verlassen der Seite:', e);
  }
});

// BroadcastChannel und storage-Listener, damit andere Tabs aufgefordert werden können aufzuräumen
try {
  const lobbyControlChannel = new BroadcastChannel('lobby-control');
  lobbyControlChannel.addEventListener('message', (evt) => {
    try {
      if (evt && evt.data && evt.data.action === 'close-all') {
        console.log('📣 Broadcast: Schließe alle Lobby-Verbindungen');
        cleanupPeer();
      }
    } catch (e) {
      console.warn('Fehler beim Verarbeiten der Broadcast-Nachricht:', e);
    }
  });
} catch (e) {
  // BroadcastChannel nicht unterstützt - Fallback via localStorage events verwendet weiter unten
}

// Storage-Event: reagiert auf setItem von anderen Tabs
window.addEventListener('storage', (evt) => {
  try {
    if (evt.key === 'closeAllLobbies') {
      console.log('📣 Storage-Event: Schließe alle Lobby-Verbindungen (key closeAllLobbies)');
      cleanupPeer();
    }
  } catch (e) {
    console.warn('Fehler beim Verarbeiten des storage-events:', e);
  }
});

// ========================================
// CSS Animation
// ========================================
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(300px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;
document.head.appendChild(style);

// Neue Hilfsfunktion: wendet die gespeicherte Hintergrundsklasse an
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

// Debug-Hilfe: Berichte aktuellen P2P-Status in der Konsole
window.reportP2PStatus = function() {
  try {
    console.log('--- P2P STATUS REPORT ---');
    console.log('isHost:', isHost);
    console.log('lobbyCode:', lobbyCode);
    console.log('peer object:', peer);

    const report = {
      isHost: !!isHost,
      lobbyCode: lobbyCode || null,
      peerConnections: []
    };

    function inspectPC(pc) {
      try {
        const state = {
          iceConnectionState: pc.iceConnectionState,
          connectionState: pc.connectionState || null,
          localDescription: !!pc.localDescription,
          remoteDescription: !!pc.remoteDescription
        };
        // stop senders' tracks to try release NAT keepalives
        try {
          if (pc.getSenders) {
            pc.getSenders().forEach(s => { try { if (s && s.track) s.track.stop(); } catch(e){} });
          }
        } catch (e) { /* ignore */ }
        return state;
      } catch (e) {
        return { error: String(e) };
      }
    }

    try {
      if (peer && peer.connections) {
        Object.keys(peer.connections).forEach(k => {
          const arr = peer.connections[k] || [];
          arr.forEach((c) => {
            const pc = c._pc || c.peerConnection || (c._negotiator && c._negotiator._pc) || null;
            const entry = { peerId: c.peer, open: !!c.open, pc: null };
            if (pc) entry.pc = inspectPC(pc);
            report.peerConnections.push(entry);
          });
        });
      }
    } catch (e) { console.warn('Fehler beim Zugriff auf peer.connections:', e); }

    try {
      if (hostConnection) {
        const pc = hostConnection._pc || hostConnection.peerConnection || (hostConnection._negotiator && hostConnection._negotiator._pc) || null;
        const entry = { peerId: hostConnection.peer, open: !!hostConnection.open, pc: null };
        if (pc) entry.pc = inspectPC(pc);
        report.peerConnections.push(entry);
      }
    } catch (e) { /* ignore */ }

    // Also check connections Map
    if (connections && connections.size) {
      connections.forEach((c, id) => {
        const pc = c._pc || c.peerConnection || (c._negotiator && c._negotiator._pc) || null;
        const entry = { mapKey: id, peerId: c.peer, open: !!c.open, pc: null };
        if (pc) entry.pc = inspectPC(pc);
        report.peerConnections.push(entry);
      });
    }

    console.log('P2P Report summary:', report);
    console.log('--- END P2P STATUS REPORT ---');
    return report;
  } catch (e) {
    console.error('Fehler beim Erstellen des P2P-Statusreports:', e);
    return { error: String(e) };
  }
};
