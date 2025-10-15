// ========================================
// LOBBY SYSTEM - FUNKTIONIERENDES PEER-TO-PEER
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

  // Starte P2P-Verbindung mit kurzer Verzögerung
  setTimeout(() => initPeerConnection(), 300);
});

// ========================================
// PEER-TO-PEER INITIALISIERUNG
// ========================================
function initPeerConnection() {
  console.log('🌐 Initialisiere P2P...');

  // Verbesserte PeerJS-Konfiguration
  const peerConfig = {
    debug: 2, // Aktiviere Debug-Logs
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  };

  if (isHost) {
    // HOST: Erstelle Peer mit Lobby-Code als ID
    console.log('🏠 Erstelle Host-Peer mit Code:', lobbyCode);
    showNotification('Erstelle Lobby...', 'info', 2000);

    peer = new Peer(lobbyCode, peerConfig);

    peer.on('open', function(id) {
      console.log('✅ Host-Peer bereit mit ID:', id);
      console.log('📡 Host wartet auf Verbindungen...');
      showNotification('✅ Lobby bereit! Code: ' + lobbyCode, 'success', 3000);
      displayHostInfo();
    });

    peer.on('connection', function(conn) {
      console.log('👤 Spieler verbindet sich:', conn.peer);
      showNotification('Spieler verbindet sich...', 'info', 2000);
      handleNewConnection(conn);
    });

    peer.on('error', function(err) {
      console.error('❌ Host Peer Fehler:', err);

      if (err.type === 'unavailable-id') {
        showNotification('⚠️ Lobby-Code bereits vergeben! Bitte neue Lobby erstellen.', 'error', 5000);
        setTimeout(() => {
          localStorage.removeItem('lobbyCode');
          localStorage.removeItem('isHost');
          window.location.href = 'index.html';
        }, 5000);
      } else if (err.type === 'network') {
        showNotification('❌ Netzwerkfehler. Prüfe deine Internetverbindung.', 'error', 5000);
      } else if (err.type === 'server-error') {
        showNotification('❌ Server-Fehler. Bitte versuche es erneut.', 'error', 5000);
      } else {
        showNotification('Fehler: ' + err.type, 'error', 3000);
      }
    });

    peer.on('disconnected', function() {
      console.warn('⚠️ Host-Peer getrennt');
      showNotification('⚠️ Verbindung unterbrochen', 'error', 3000);
    });

  } else {
    // SPIELER: Erstelle Peer und verbinde zum Host
    console.log('👤 Erstelle Spieler-Peer...');
    showNotification('Verbinde zur Lobby...', 'info', 2000);

    peer = new Peer(peerConfig);

    peer.on('open', function(id) {
      console.log('✅ Spieler-Peer erstellt mit ID:', id);
      console.log('🔗 Versuche Verbindung zum Host:', lobbyCode);

      // Warte kurz, dann verbinde zum Host
      setTimeout(() => {
        connectToHost();
      }, 1000);
    });

    peer.on('error', function(err) {
      console.error('❌ Spieler Peer Fehler:', err);
      showNotification('❌ Verbindung fehlgeschlagen: ' + err.type, 'error', 4000);

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 4000);
    });

    peer.on('disconnected', function() {
      console.warn('⚠️ Spieler-Peer getrennt');
      showNotification('⚠️ Verbindung unterbrochen', 'error', 3000);
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
    console.log('📥 Daten vom Spieler empfangen:', data);

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
    console.error('❌ Verbindungsfehler mit Spieler:', err);
  });
}

// ========================================
// SPIELER: ZUM HOST VERBINDEN
// ========================================
function connectToHost() {
  console.log('🔗 Starte Verbindung zum Host mit Code:', lobbyCode);

  try {
    const conn = peer.connect(lobbyCode, {
      reliable: true,
      serialization: 'json'
    });

    if (!conn) {
      console.error('❌ Konnte Verbindung nicht erstellen');
      showNotification('❌ Lobby nicht gefunden!', 'error', 4000);
      setTimeout(() => window.location.href = 'index.html', 4000);
      return;
    }

    connections.push(conn);

    // Timeout wenn Verbindung zu lange dauert
    const connectionTimeout = setTimeout(() => {
      if (!conn.open) {
        console.error('❌ Verbindungs-Timeout');
        showNotification('❌ Lobby nicht gefunden! Timeout.', 'error', 4000);
        setTimeout(() => window.location.href = 'index.html', 4000);
      }
    }, 10000); // 10 Sekunden Timeout

    conn.on('open', function() {
      clearTimeout(connectionTimeout);
      console.log('✅ Mit Host verbunden!');
      showNotification('✅ Verbunden!', 'success', 2000);

      // Sende Join-Request
      const joinData = {
        type: 'join',
        player: {
          id: peer.id,
          name: currentUser.global_name || currentUser.username,
          avatar: getUserAvatar(currentUser),
          score: 0
        }
      };

      console.log('📤 Sende Join-Request:', joinData);
      conn.send(joinData);
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
      clearTimeout(connectionTimeout);
      console.log('❌ Verbindung zum Host verloren');
      showNotification('❌ Verbindung zum Host verloren', 'error', 3000);
      setTimeout(() => window.location.href = 'index.html', 3000);
    });

    conn.on('error', function(err) {
      clearTimeout(connectionTimeout);
      console.error('❌ Verbindungsfehler:', err);
      showNotification('❌ Lobby nicht gefunden! Code falsch?', 'error', 4000);
      setTimeout(() => window.location.href = 'index.html', 4000);
    });

  } catch (error) {
    console.error('❌ Fehler beim Verbinden:', error);
    showNotification('❌ Verbindungsfehler!', 'error', 4000);
    setTimeout(() => window.location.href = 'index.html', 4000);
  }
}

// ========================================
// SPIELERLISTE BROADCASTEN
// ========================================
function broadcastPlayerList() {
  const message = {
    type: 'player-list',
    players: players
  };

  console.log('📡 Broadcast Spielerliste an', connections.length, 'Spieler');

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
  console.log('🔄 Aktualisiere Spielerliste:', newPlayers);
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
  console.log('➕ Spieler zur DOM hinzugefügt:', player.name);
}

// ========================================
// CURRENT USER LADEN
// ========================================
function loadCurrentUser() {
  const storedUser = localStorage.getItem('discordUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    console.log('👤 User geladen:', currentUser.username);
  } else {
    // Fallback für Test ohne Discord
    currentUser = {
      id: 'user_' + Date.now(),
      username: 'TestUser',
      global_name: 'Test User',
      discriminator: '0000',
      avatar: null
    };
    console.log('👤 Fallback User erstellt');
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
    console.log('👑 Zeige Host-Info:', hostData.name);
    hostAvatar.src = hostData.avatar;
    hostName.textContent = hostData.name;
  } else if (currentUser) {
    // Host: Zeige eigene Daten
    console.log('👑 Zeige eigene Host-Info');
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
      console.log('🎮 Quiz wird gestartet...');
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

  console.log('🚪 Verlasse Lobby...');

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
  console.log('🎮 Quiz gestartet mit', (players.length + 1), 'Spielern');
  setTimeout(() => {
    alert('Quiz startet!\n\nSpieler: ' + (players.length + 1) + '\n\n(Quiz-Funktionalität wird noch implementiert)');
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

console.log('✅ P2P Lobby System mit Debug-Modus geladen!');

