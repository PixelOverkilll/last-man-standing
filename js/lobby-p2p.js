// ========================================
// LOBBY MIT PEER-TO-PEER HOSTING - ULTRASCHNELL
// ========================================

console.log('🎮 P2P Lobby lädt...');

// Globale Variablen
let isHost = false;
let lobbyCode = '';
let players = [];
let peer = null;
let connections = [];
let hostInfo = null;

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

  initUI();
  setupEventListeners();

  // Starte Peer-Verbindung SOFORT ohne Verzögerung
  initPeerConnection();
});

// ========================================
// PEER-TO-PEER VERBINDUNG - ULTRASCHNELL & MINIMAL
// ========================================
function initPeerConnection() {
  console.log('🌐 Initialisiere Peer-Verbindung...');

  // MINIMAL-Konfiguration für maximale Geschwindigkeit
  const peerConfig = {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ],
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 5
    }
  };

  if (isHost) {
    console.log('🏠 Starte als HOST');
    showNotification('Erstelle Lobby...', 'info', 1000);

    peer = new Peer(lobbyCode, peerConfig);

    peer.on('open', function(id) {
      console.log('✅ Host-Lobby erstellt mit ID:', id);
      showNotification('✅ Lobby bereit!', 'success', 1500);
    });

    peer.on('connection', function(conn) {
      console.log('👤 Neuer Spieler verbindet sich...');
      handleNewConnection(conn);
    });

    peer.on('error', function(err) {
      console.error('❌ Peer Fehler:', err);
      showNotification('Fehler: ' + err.type, 'error', 3000);
      if (err.type === 'unavailable-id') {
        setTimeout(() => {
          localStorage.removeItem('lobbyCode');
          window.location.href = 'index.html';
        }, 3000);
      }
    });

  } else {
    console.log('👤 Starte als SPIELER');
    showNotification('Verbinde...', 'info', 1000);

    peer = new Peer(peerConfig);

    peer.on('open', function(id) {
      console.log('✅ Spieler-Peer erstellt mit ID:', id);
      connectToHost();
    });

    peer.on('error', function(err) {
      console.error('❌ Peer Fehler:', err);
      showNotification('Verbindung fehlgeschlagen', 'error', 3000);
      setTimeout(() => window.location.href = 'index.html', 3000);
    });
  }
}

// ========================================
// HOST: NEUE VERBINDUNG
// ========================================
function handleNewConnection(conn) {
  connections.push(conn);

  conn.on('open', function() {
    console.log('✅ Spieler verbunden:', conn.peer);

    const storedUser = localStorage.getItem('discordUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      conn.send({
        type: 'host-info',
        host: {
          name: user.global_name || user.username,
          avatar: user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`
        }
      });
    }

    conn.send({
      type: 'player-list',
      players: players
    });
  });

  conn.on('data', function(data) {
    if (data.type === 'join') {
      addNewPlayer(data.player, conn.peer);
      broadcastPlayerList();
    }
  });

  conn.on('close', function() {
    console.log('👋 Spieler getrennt:', conn.peer);
    removePlayer(conn.peer);
    broadcastPlayerList();
    connections = connections.filter(c => c !== conn);
  });

  conn.on('error', function(err) {
    console.error('❌ Connection Error:', err);
  });
}

// ========================================
// SPIELER: ZUM HOST VERBINDEN - ULTRASCHNELL
// ========================================
function connectToHost() {
  console.log('🔗 Verbinde zum Host...');

  const conn = peer.connect(lobbyCode, {
    reliable: true,
    serialization: 'json'
  });

  let connected = false;

  // Timeout nur 8 Sekunden
  const timeout = setTimeout(() => {
    if (!connected) {
      console.error('❌ Verbindungstimeout');
      showNotification('❌ Lobby nicht gefunden', 'error', 2000);
      setTimeout(() => window.location.href = 'index.html', 2000);
    }
  }, 8000);

  conn.on('open', function() {
    connected = true;
    clearTimeout(timeout);
    console.log('✅ Mit Host verbunden!');
    showNotification('✅ Verbunden!', 'success', 1000);

    const storedUser = localStorage.getItem('discordUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      conn.send({
        type: 'join',
        player: {
          id: peer.id,
          name: user.global_name || user.username,
          avatar: user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`,
          score: 0
        }
      });
    }
  });

  conn.on('data', function(data) {
    if (data.type === 'host-info') {
      hostInfo = data.host;
      displayHostInfo(hostInfo);
    } else if (data.type === 'player-list') {
      updatePlayerList(data.players);
    } else if (data.type === 'start-quiz') {
      startQuiz();
    }
  });

  conn.on('error', function(err) {
    clearTimeout(timeout);
    console.error('❌ Verbindungsfehler:', err);
    showNotification('❌ Lobby nicht gefunden', 'error', 2000);
    setTimeout(() => window.location.href = 'index.html', 2000);
  });

  connections.push(conn);
}

// ========================================
// HOST INFO ANZEIGEN
// ========================================
function displayHostInfo(host) {
  const hostAvatar = document.getElementById('host-avatar');
  const hostName = document.getElementById('host-name');
  hostAvatar.src = host.avatar;
  hostName.textContent = host.name;
}

// ========================================
// SPIELER HINZUFÜGEN
// ========================================
function addNewPlayer(player, peerId) {
  if (players.find(p => p.id === peerId)) return;

  player.id = peerId;
  players.push(player);
  addPlayerToDOM(player);
  showNotification(player.name + ' ist beigetreten! 🎉', 'success', 1500);
}

// ========================================
// SPIELERLISTE AKTUALISIEREN
// ========================================
function updatePlayerList(newPlayers) {
  players = newPlayers;
  const playersContainer = document.getElementById('players-container');
  playersContainer.innerHTML = '';
  players.forEach(player => addPlayerToDOM(player));
}

// ========================================
// SPIELERLISTE BROADCASTEN
// ========================================
function broadcastPlayerList() {
  const message = { type: 'player-list', players: players };
  connections.forEach(conn => {
    if (conn.open) {
      try {
        conn.send(message);
      } catch (err) {
        console.error('❌ Fehler beim Senden:', err);
      }
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
    const playerCard = document.getElementById(`player-${peerId}`);
    if (playerCard) playerCard.remove();
    showNotification(player.name + ' hat verlassen', 'info', 1500);
  }
}

// ========================================
// SPIELER ZUM DOM HINZUFÜGEN
// ========================================
function addPlayerToDOM(player) {
  const playersContainer = document.getElementById('players-container');
  const playerCard = document.createElement('div');
  playerCard.className = 'player-card';
  playerCard.id = `player-${player.id}`;
  playerCard.innerHTML = `
    <img src="${player.avatar}" alt="${player.name}" class="player-avatar">
    <span class="player-name">${player.name}</span>
    <span class="player-score">${player.score} Punkte</span>
  `;
  playersContainer.appendChild(playerCard);
}

// ========================================
// UI INITIALISIERUNG
// ========================================
function initUI() {
  document.getElementById('lobby-code-display').textContent = lobbyCode;
  const lobbyCodeContainer = document.getElementById('lobby-code-container');
  const hostControls = document.getElementById('host-controls');

  if (isHost) {
    lobbyCodeContainer.style.display = 'flex';
    hostControls.style.display = 'block';
    loadHostInfoForHost();
  } else {
    lobbyCodeContainer.style.display = 'none';
    hostControls.style.display = 'none';
    setPlaceholderHost();
  }
}

// ========================================
// HOST INFO LADEN
// ========================================
function loadHostInfoForHost() {
  const storedUser = localStorage.getItem('discordUser');
  if (!storedUser) {
    setPlaceholderHost();
    return;
  }

  try {
    const user = JSON.parse(storedUser);
    const hostAvatar = document.getElementById('host-avatar');
    const hostName = document.getElementById('host-name');

    if (user.avatar) {
      hostAvatar.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    } else {
      hostAvatar.src = `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`;
    }

    hostName.textContent = user.global_name || user.username;
  } catch (error) {
    setPlaceholderHost();
  }
}

function setPlaceholderHost() {
  document.getElementById('host-avatar').src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Host';
  document.getElementById('host-name').textContent = 'Verbinde...';
}

// ========================================
// BENACHRICHTIGUNG - SCHNELLER
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
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  const startBtn = document.getElementById('start-quiz-btn');
  if (startBtn && isHost) {
    startBtn.addEventListener('click', function() {
      connections.forEach(conn => {
        if (conn.open) {
          try {
            conn.send({ type: 'start-quiz' });
          } catch (err) {
            console.error('❌ Fehler beim Senden:', err);
          }
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

  if (peer) {
    connections.forEach(conn => {
      if (conn.open) {
        try {
          conn.close();
        } catch (err) {
          console.error('❌ Fehler beim Schließen:', err);
        }
      }
    });
    peer.destroy();
  }

  localStorage.removeItem('lobbyCode');
  localStorage.removeItem('isHost');

  showNotification('Lobby verlassen', 'info', 500);
  setTimeout(() => window.location.href = 'index.html', 500);
}

function startQuiz() {
  showNotification('Quiz startet! 🎮', 'success', 2000);
  setTimeout(() => alert('Quiz-Modus kommt bald!'), 1000);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
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

console.log('✅ P2P Lobby geladen!');

