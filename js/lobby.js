// ========================================
// LOBBY SYSTEM - EINFACHES PEER-TO-PEER
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
// INITIALISIERUNG
// ========================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM geladen');

  const urlParams = new URLSearchParams(window.location.search);
  lobbyCode = urlParams.get('code') || localStorage.getItem('lobbyCode');
  isHost = localStorage.getItem('isHost') === 'true';

  console.log('🔍 Lobby Code:', lobbyCode);
  console.log('🔍 Ist Host:', isHost);

  if (!lobbyCode) {
    showNotification('❌ Kein Lobby-Code gefunden!', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
    return;
  }

  // Lade User-Daten
  loadCurrentUser();

  // UI initialisieren
  initUI();
  setupEventListeners();

  // Starte P2P-Verbindung
  initPeerConnection();
});

// ========================================
// PEER-TO-PEER INITIALISIERUNG
// ========================================
function initPeerConnection() {
  console.log('🌐 Initialisiere P2P...');

  if (isHost) {
    // HOST: Erstelle Peer mit Lobby-Code als ID
    peer = new Peer(lobbyCode, {
      debug: 0
    });

    peer.on('open', function(id) {
      console.log('✅ Host-Peer erstellt mit ID:', id);
      showNotification('✅ Lobby bereit!', 'success', 2000);
      displayHostInfo();
    });

    peer.on('connection', function(conn) {
      console.log('👤 Spieler verbindet sich:', conn.peer);
      handleNewConnection(conn);
    });

    peer.on('error', function(err) {
      console.error('❌ Peer Fehler:', err);
      showNotification('Fehler: ' + err.type, 'error', 3000);
    });

  } else {
    // SPIELER: Erstelle Peer und verbinde zum Host
    peer = new Peer({
      debug: 0
    });

    peer.on('open', function(id) {
      console.log('✅ Spieler-Peer erstellt mit ID:', id);
      connectToHost();
    });

    peer.on('error', function(err) {
      console.error('❌ Peer Fehler:', err);
      showNotification('Verbindung fehlgeschlagen', 'error', 3000);
    });
  }
}

// ========================================
// HOST: NEUE SPIELER-VERBINDUNG
// ========================================
function handleNewConnection(conn) {
  connections.push(conn);

  conn.on('open', function() {
    console.log('✅ Spieler verbunden:', conn.peer);

    // Sende Host-Info an Spieler
    conn.send({
      type: 'host-info',
      host: {
        id: currentUser.id,
        name: currentUser.global_name || currentUser.username,
        avatar: getUserAvatar(currentUser)
      }
    });

    // Sende aktuelle Spielerliste
    conn.send({
      type: 'player-list',
      players: players
    });
  });

  conn.on('data', function(data) {
    console.log('📥 Daten empfangen:', data);

    if (data.type === 'join') {
      // Spieler möchte beitreten
      const player = data.player;
      player.id = conn.peer;

      // Füge Spieler zur Liste hinzu
      if (!players.find(p => p.id === player.id)) {
        players.push(player);
        addPlayerToDOM(player);
        showNotification(player.name + ' ist beigetreten! 🎉', 'success', 2000);

        // Informiere alle anderen Spieler
        broadcastPlayerList();
      }
    }
  });

  conn.on('close', function() {
    console.log('👋 Spieler getrennt:', conn.peer);
    removePlayer(conn.peer);
    connections = connections.filter(c => c !== conn);
  });

  conn.on('error', function(err) {
    console.error('❌ Verbindungsfehler:', err);
  });
}

// ========================================
// SPIELER: ZUM HOST VERBINDEN
// ========================================
function connectToHost() {
  console.log('🔗 Verbinde zum Host mit Code:', lobbyCode);
  showNotification('Verbinde...', 'info', 1500);

  const conn = peer.connect(lobbyCode, {
    reliable: true
  });

  connections.push(conn);

  conn.on('open', function() {
    console.log('✅ Mit Host verbunden!');
    showNotification('✅ Verbunden!', 'success', 1500);

    // Sende Join-Request
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
    console.log('📥 Daten vom Host:', data);

    if (data.type === 'host-info') {
      // Zeige Host-Info
      displayHostInfo(data.host);
    } else if (data.type === 'player-list') {
      // Aktualisiere Spielerliste
      updatePlayerList(data.players);
    } else if (data.type === 'start-quiz') {
      // Quiz wird gestartet
      startQuiz();
    }
  });

  conn.on('close', function() {
    console.log('❌ Verbindung zum Host verloren');
    showNotification('❌ Verbindung verloren', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
  });

  conn.on('error', function(err) {
    console.error('❌ Verbindungsfehler:', err);
    showNotification('❌ Lobby nicht gefunden!', 'error', 3000);
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
    if (conn.open) {
      conn.send(message);
    }
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
  players = newPlayers;
  const container = document.getElementById('players-container');
  container.innerHTML = '';
  players.forEach(player => addPlayerToDOM(player));
}

// ========================================
// SPIELER ZUM DOM HINZUFÜGEN
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
}

// ========================================
// CURRENT USER LADEN
// ========================================
function loadCurrentUser() {
  const storedUser = localStorage.getItem('discordUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
  } else {
    // Fallback für Test ohne Discord
    currentUser = {
      id: 'user_' + Date.now(),
      username: 'TestUser',
      global_name: 'Test User',
      discriminator: '0000',
      avatar: null
    };
  }
}

// ========================================
// HOST INFO ANZEIGEN
// ========================================
function displayHostInfo(hostData) {
  const hostAvatar = document.getElementById('host-avatar');
  const hostName = document.getElementById('host-name');

  if (hostData) {
    // Spieler: Zeige Host-Daten vom Server
    hostAvatar.src = hostData.avatar;
    hostName.textContent = hostData.name;
  } else if (currentUser) {
    // Host: Zeige eigene Daten
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

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  const startBtn = document.getElementById('start-quiz-btn');
  if (startBtn && isHost) {
    startBtn.addEventListener('click', function() {
      // Sende Start-Signal an alle Spieler
      connections.forEach(conn => {
        if (conn.open) {
          conn.send({ type: 'start-quiz' });
        }
      });
      startQuiz();
    });
  }

  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);
  }

  const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
  if (leaveLobbyBtn) {
    leaveLobbyBtn.addEventListener('click', leaveLobby);
  }
}

// ========================================
// LOBBY VERLASSEN
// ========================================
function leaveLobby() {
  if (!confirm('Lobby wirklich verlassen?')) return;

  // Schließe alle Verbindungen
  connections.forEach(conn => {
    if (conn.open) conn.close();
  });

  if (peer) {
    peer.destroy();
  }

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
  setTimeout(() => {
    alert('Quiz startet!\n\nSpieler: ' + (players.length + 1));
  }, 1000);
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

// ========================================
// CSS ANIMATION
// ========================================
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(300px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;
document.head.appendChild(style);

console.log('✅ P2P Lobby System geladen!');

