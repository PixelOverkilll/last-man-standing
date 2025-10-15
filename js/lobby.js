  if (peer) peer.destroy();

  localStorage.removeItem('lobbyCode');
  localStorage.removeItem('isHost');

  showNotification('Lobby verlassen', 'info', 500);
  setTimeout(() => window.location.href = 'index.html', 500);
}

// ========================================
// QUIZ STARTEN
// ========================================
function startQuiz() {
  showNotification('Quiz startet! 🎮', 'success', 2000);
  console.log('🎮 Quiz gestartet mit', (players.length + 1), 'Spielern');
}

// ========================================
// FULLSCREEN TOGGLE
// ========================================
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Fullscreen fehlgeschlagen:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// ========================================
// BENACHRICHTIGUNG
// ========================================
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

// CSS ANIMATION
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(300px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;
document.head.appendChild(style);

console.log('✅ P2P Lobby System mit sofortiger Host-Anzeige geladen!');
// ========================================
// LOBBY SYSTEM - VERBESSERT MIT SOFORTIGER HOST-ANZEIGE
// ========================================

console.log('🎮 P2P Lobby System lädt...');

// Globale Variablen
let isHost = false;
let lobbyCode = '';
let currentUser = null;
let peer = null;
let connections = [];
let players = [];

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

  playerCard.style.borderColor = color;
  playerCard.style.boxShadow = `0 15px 40px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.8)`;

  const avatar = playerCard.querySelector('.player-avatar');
  if (avatar) {
    avatar.style.borderColor = color;
    avatar.style.boxShadow = `0 0 25px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`;
  }

  const scoreElement = playerCard.querySelector('.player-score');
  if (scoreElement) {
    scoreElement.style.borderColor = color;
    scoreElement.style.backgroundColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
  }
}

// ========================================
// INITIALISIERUNG - VERBESSERT MIT SOFORTIGER HOST-ANZEIGE
// ========================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM geladen');

  const urlParams = new URLSearchParams(window.location.search);
  lobbyCode = urlParams.get('code') || localStorage.getItem('lobbyCode');

  const storedLobbyCode = localStorage.getItem('lobbyCode');
  const storedIsHost = localStorage.getItem('isHost');

  console.log('🔍 URL Lobby Code:', urlParams.get('code'));
  console.log('🔍 Stored Lobby Code:', storedLobbyCode);
  console.log('🔍 Stored isHost:', storedIsHost);

  if (lobbyCode && storedLobbyCode === lobbyCode && storedIsHost === 'true') {
    isHost = true;
    console.log('✅ Host erkannt! (Code stimmt überein)');
  } else if (storedIsHost === 'true' && !urlParams.get('code')) {
    isHost = true;
    lobbyCode = storedLobbyCode;
    console.log('✅ Host erkannt! (Aus localStorage)');
  } else {
    isHost = false;
    console.log('👤 Als Spieler beigetreten');
  }

  console.log('🔍 Finale Lobby Code:', lobbyCode);
  console.log('🔍 Finale isHost:', isHost);

  if (!lobbyCode) {
    console.error('❌ Kein Lobby-Code gefunden!');
    showNotification('❌ Kein Lobby-Code gefunden!', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
    return;
  }

  if (!loadCurrentUser()) {
    console.error('❌ Kein User gefunden - zurück zur Startseite');
    showNotification('❌ Bitte melde dich zuerst an!', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
    return;
  }

  // WICHTIG: Zeige Host-Info SOFORT an, nicht erst nach Peer-Verbindung!
  if (isHost) {
    console.log('🎯 Zeige Host-Info sofort an');
    displayHostInfo();
  }

  initUI();
  setupEventListeners();
  setTimeout(() => initPeerConnection(), 300);
});

// ========================================
// PEER-TO-PEER INITIALISIERUNG
// ========================================
function initPeerConnection() {
  console.log('🌐 Initialisiere P2P...');
  console.log('🔍 isHost:', isHost, '| Code:', lobbyCode);

  const peerConfig = {
    debug: 2,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }
  };

  if (isHost) {
    console.log('🏠 Erstelle Host-Peer mit Code:', lobbyCode);
    showNotification('Erstelle Lobby...', 'info', 2000);

    peer = new Peer(lobbyCode, peerConfig);

    peer.on('open', function(id) {
      console.log('✅ Host-Peer bereit mit ID:', id);
      console.log('📡 Host wartet auf Verbindungen...');
      showNotification('✅ Lobby bereit! Code: ' + lobbyCode, 'success', 3000);
    });

    peer.on('connection', function(conn) {
      console.log('👤 Spieler verbindet sich:', conn.peer);
      showNotification('Spieler verbindet sich...', 'info', 2000);
      handleNewConnection(conn);
    });

    peer.on('error', function(err) {
      console.error('❌ Host Peer Fehler:', err);
      if (err.type === 'unavailable-id') {
        showNotification('⚠️ Lobby-Code bereits vergeben!', 'error', 5000);
        setTimeout(() => {
          localStorage.removeItem('lobbyCode');
          localStorage.removeItem('isHost');
          window.location.href = 'index.html';
        }, 5000);
      } else if (err.type === 'network') {
        showNotification('⚠️ Netzwerkfehler - Lobby läuft offline', 'error', 3000);
      } else {
        showNotification('⚠️ Fehler: ' + err.type, 'error', 3000);
      }
    });

  } else {
    console.log('👤 Erstelle Spieler-Peer...');
    showNotification('Verbinde zur Lobby...', 'info', 2000);

    peer = new Peer(peerConfig);

    peer.on('open', function(id) {
      console.log('✅ Spieler-Peer erstellt mit ID:', id);
      setTimeout(() => connectToHost(), 1000);
    });

    peer.on('error', function(err) {
      console.error('❌ Spieler Peer Fehler:', err);
      showNotification('❌ Verbindung fehlgeschlagen: ' + err.type, 'error', 4000);
      setTimeout(() => window.location.href = 'index.html', 4000);
    });
  }
}

// ========================================
// HOST: NEUE SPIELER-VERBINDUNG
// ========================================
function handleNewConnection(conn) {
  console.log('🔗 Verarbeite neue Verbindung von:', conn.peer);
  connections.push(conn);

  conn.on('open', function() {
    console.log('✅ Spieler verbunden:', conn.peer);

    conn.send({
      type: 'host-info',
      host: {
        id: currentUser.id,
        name: currentUser.global_name || currentUser.username,
        avatar: getUserAvatar(currentUser)
      }
    });

    conn.send({
      type: 'player-list',
      players: players
    });
  });

  conn.on('data', function(data) {
    console.log('📥 Daten vom Spieler empfangen:', data);

    if (data.type === 'join') {
      const player = data.player;
      player.id = conn.peer;

      if (!players.find(p => p.id === player.id)) {
        players.push(player);
        addPlayerToDOM(player);
        showNotification(player.name + ' ist beigetreten! 🎉', 'success', 2000);
        broadcastPlayerList();
      }
    }
  });

  conn.on('close', function() {
    console.log('👋 Spieler getrennt:', conn.peer);
    removePlayer(conn.peer);
    connections = connections.filter(c => c !== conn);
  });
}

// ========================================
// SPIELER: ZUM HOST VERBINDEN
// ========================================
function connectToHost() {
  console.log('🔗 Starte Verbindung zum Host mit Code:', lobbyCode);

  const conn = peer.connect(lobbyCode, {
    reliable: true,
    serialization: 'json'
  });

  if (!conn) {
    showNotification('❌ Lobby nicht gefunden!', 'error', 4000);
    setTimeout(() => window.location.href = 'index.html', 4000);
    return;
  }

  connections.push(conn);

  const connectionTimeout = setTimeout(() => {
    if (!conn.open) {
      showNotification('❌ Lobby nicht gefunden! Timeout.', 'error', 4000);
      setTimeout(() => window.location.href = 'index.html', 4000);
    }
  }, 10000);

  conn.on('open', function() {
    clearTimeout(connectionTimeout);
    console.log('✅ Mit Host verbunden!');
    showNotification('✅ Verbunden!', 'success', 2000);

    conn.send({
      type: 'join',
      player: {
        id: peer.id,
        name: currentUser.global_name || currentUser.username,
        avatar: getUserAvatar(currentUser),
        score: 0
      }
    });
  });

  conn.on('data', function(data) {
    if (data.type === 'host-info') {
      displayHostInfo(data.host);
    } else if (data.type === 'player-list') {
      updatePlayerList(data.players);
    } else if (data.type === 'start-quiz') {
      startQuiz();
    }
  });

  conn.on('close', function() {
    clearTimeout(connectionTimeout);
    showNotification('❌ Verbindung zum Host verloren', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
  });
}

// ========================================
// SPIELERLISTE BROADCASTEN
// ========================================
function broadcastPlayerList() {
  const message = {
    type: 'player-list',
    players: players
  };

  connections.forEach(conn => {
    if (conn.open) conn.send(message);
  });
}

// ========================================
// SPIELER ENTFERNEN
// ========================================
function removePlayer(peerId) {
  const player = players.find(p => p.id === peerId);
  if (player) {
    players = players.filter(p => p.id !== peerId);
    const playerCard = document.getElementById('player-' + peerId);
    if (playerCard) playerCard.remove();
    showNotification(player.name + ' hat verlassen', 'info', 2000);
    broadcastPlayerList();
  }
}

// ========================================
// SPIELERLISTE AKTUALISIEREN
// ========================================
function updatePlayerList(newPlayers) {
  console.log('🔄 Aktualisiere Spielerliste:', newPlayers);
  players = newPlayers;
  const container = document.getElementById('players-container');
  container.innerHTML = '';
  players.forEach(player => addPlayerToDOM(player));
}

// ========================================
// SPIELER ZUM DOM HINZUFÜGEN - VERBESSERT
// ========================================
function addPlayerToDOM(player) {
  const container = document.getElementById('players-container');
  const card = document.createElement('div');
  card.className = 'player-card';
  card.id = 'player-' + player.id;
  card.innerHTML = `
    <img src="${player.avatar}" alt="${player.name}" class="player-avatar">
    <span class="player-name">${player.name}</span>
    <span class="player-score">${player.score} Punkte</span>
  `;
  container.appendChild(card);

  extractDominantColor(player.avatar, (color) => {
    applyPlayerColor(card, color);
  });

  console.log('➕ Spieler zur DOM hinzugefügt:', player.name);
}

// ========================================
// CURRENT USER LADEN - VERBESSERT
// ========================================
function loadCurrentUser() {
  const storedUser = localStorage.getItem('discordUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    console.log('👤 User geladen:', currentUser.username || currentUser.global_name);
    return true;
  } else {
    console.error('❌ Kein User im localStorage gefunden!');
    currentUser = null;
    return false;
  }
}

// ========================================
// HOST INFO ANZEIGEN
// ========================================
function displayHostInfo(hostData) {
  const hostAvatar = document.getElementById('host-avatar');
  const hostName = document.getElementById('host-name');

  if (!hostAvatar || !hostName) {
    console.error('❌ Host-Elemente nicht gefunden!');
    return;
  }

  if (hostData) {
    console.log('👑 Zeige Host-Info vom Server:', hostData.name);
    hostAvatar.src = hostData.avatar;
    hostName.textContent = hostData.name;
  } else if (currentUser) {
    console.log('👑 Zeige eigene Host-Info:', currentUser.global_name || currentUser.username);
    hostAvatar.src = getUserAvatar(currentUser);
    hostName.textContent = currentUser.global_name || currentUser.username;
  }
}

// ========================================
// USER AVATAR HOLEN
// ========================================
function getUserAvatar(user) {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  } else {
    const discriminator = parseInt(user.discriminator || '0') % 5;
    return `https://cdn.discordapp.com/embed/avatars/${discriminator}.png`;
  }
}

// ========================================
// UI INITIALISIERUNG
// ========================================
function initUI() {
  const lobbyCodeDisplay = document.getElementById('lobby-code-display');
  const lobbyCodeContainer = document.getElementById('lobby-code-container');
  const hostControls = document.getElementById('host-controls');

  if (lobbyCodeDisplay) lobbyCodeDisplay.textContent = lobbyCode;

  if (isHost) {
    console.log('🎮 UI als Host initialisiert');
    if (lobbyCodeContainer) lobbyCodeContainer.style.display = 'flex';
    if (hostControls) hostControls.style.display = 'block';
  } else {
    console.log('👤 UI als Spieler initialisiert');
    if (lobbyCodeContainer) lobbyCodeContainer.style.display = 'none';
    if (hostControls) hostControls.style.display = 'none';
  }
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  const startBtn = document.getElementById('start-quiz-btn');
  if (startBtn && isHost) {
    startBtn.addEventListener('click', function() {
      connections.forEach(conn => {
        if (conn.open) conn.send({ type: 'start-quiz' });
      });
      startQuiz();
    });
  }

  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

  const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
  if (leaveLobbyBtn) leaveLobbyBtn.addEventListener('click', leaveLobby);
}

// ========================================
// LOBBY VERLASSEN
// ========================================
function leaveLobby() {
  if (!confirm('Lobby wirklich verlassen?')) return;

  connections.forEach(conn => {
    if (conn.open) conn.close();
  });


