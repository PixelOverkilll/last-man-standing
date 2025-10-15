// ========================================
// LOBBY MIT PEER-TO-PEER HOSTING
// ========================================

console.log('🎮 P2P Lobby lädt...');

// Globale Variablen
let isHost = false;
let lobbyCode = '';
let players = [];
let peer = null;
let connections = [];

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
  initPeerConnection();
});

// ========================================
// PEER-TO-PEER VERBINDUNG INITIALISIEREN
// ========================================
function initPeerConnection() {
  console.log('🌐 Initialisiere Peer-Verbindung...');

  if (isHost) {
    // HOST: Erstelle Peer-Server mit Lobby-Code
    peer = new Peer(lobbyCode);

    peer.on('open', function(id) {
      console.log('✅ Host-Lobby erstellt mit ID:', id);
      showNotification('Lobby erstellt! Teile den Code: ' + lobbyCode, 'success');
    });

    peer.on('connection', function(conn) {
      console.log('👤 Neuer Spieler verbindet sich...');
      handleNewConnection(conn);
    });

    peer.on('error', function(err) {
      console.error('❌ Peer Fehler:', err);
      showNotification('Lobby-Fehler: ' + err.type, 'error');
    });

  } else {
    // SPIELER: Verbinde zum Host
    peer = new Peer();

    peer.on('open', function(id) {
      console.log('✅ Spieler-Peer erstellt mit ID:', id);
      connectToHost();
    });

    peer.on('error', function(err) {
      console.error('❌ Peer Fehler:', err);
      showNotification('Verbindung fehlgeschlagen', 'error');
    });
  }
}

// ========================================
// HOST: NEUE VERBINDUNG VERWALTEN
// ========================================
function handleNewConnection(conn) {
  connections.push(conn);

  conn.on('open', function() {
    console.log('✅ Spieler verbunden:', conn.peer);

    // Sende aktuelle Spielerliste
    conn.send({
      type: 'player-list',
      players: players
    });
  });

  conn.on('data', function(data) {
    console.log('📨 Daten empfangen:', data);

    if (data.type === 'join') {
      addNewPlayer(data.player, conn.peer);
      broadcastPlayerList();
    }
  });

  conn.on('close', function() {
    console.log('👋 Spieler getrennt:', conn.peer);
    removePlayer(conn.peer);
    broadcastPlayerList();
  });
}

// ========================================
// SPIELER: ZUM HOST VERBINDEN
// ========================================
function connectToHost() {
  console.log('🔗 Verbinde zum Host mit Code:', lobbyCode);

  const conn = peer.connect(lobbyCode);

  conn.on('open', function() {
    console.log('✅ Mit Host verbunden!');
    showNotification('Mit Lobby verbunden!', 'success');

    // Sende eigene Spieler-Info
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
    console.log('📨 Daten vom Host:', data);

    if (data.type === 'player-list') {
      updatePlayerList(data.players);
    } else if (data.type === 'start-quiz') {
      startQuiz();
    }
  });

  conn.on('error', function(err) {
    console.error('❌ Verbindungsfehler:', err);
    showNotification('Lobby-Code ungültig oder Host offline', 'error');
  });

  connections.push(conn);
}

// ========================================
// NEUEN SPIELER HINZUFÜGEN (HOST)
// ========================================
function addNewPlayer(player, peerId) {
  // Prüfe Duplikate
  if (players.find(p => p.id === peerId)) {
    console.log('⚠️ Spieler bereits vorhanden');
    return;
  }

  player.id = peerId;
  players.push(player);
  addPlayerToDOM(player);

  console.log('✅ Spieler hinzugefügt:', player.name);
  showNotification(player.name + ' ist beigetreten! 🎉', 'success');
}

// ========================================
// SPIELERLISTE AKTUALISIEREN (SPIELER)
// ========================================
function updatePlayerList(newPlayers) {
  players = newPlayers;

  const playersContainer = document.getElementById('players-container');
  playersContainer.innerHTML = '';

  players.forEach(player => {
    addPlayerToDOM(player);
  });

  console.log('✅ Spielerliste aktualisiert:', players.length, 'Spieler');
}

// ========================================
// SPIELERLISTE BROADCASTEN (HOST)
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

  console.log('📡 Spielerliste gesendet an', connections.length, 'Spieler');
}

// ========================================
// SPIELER ENTFERNEN (HOST)
// ========================================
function removePlayer(peerId) {
  const player = players.find(p => p.id === peerId);
  if (player) {
    players = players.filter(p => p.id !== peerId);

    const playerCard = document.getElementById(`player-${peerId}`);
    if (playerCard) playerCard.remove();

    showNotification(player.name + ' hat die Lobby verlassen', 'info');
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
  console.log('🎨 Initialisiere UI...');

  document.getElementById('lobby-code-display').textContent = lobbyCode;

  const lobbyCodeContainer = document.getElementById('lobby-code-container');
  const hostControls = document.getElementById('host-controls');

  if (isHost) {
    lobbyCodeContainer.style.display = 'flex';
    hostControls.style.display = 'block';
    console.log('✅ Host-Modus aktiviert');
  } else {
    lobbyCodeContainer.style.display = 'none';
    hostControls.style.display = 'none';
    console.log('✅ Spieler-Modus aktiviert');
  }

  loadHostInfo();
}

// ========================================
// HOST INFO LADEN
// ========================================
function loadHostInfo() {
  console.log('🏠 Lade Host Info...');

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
    console.log('✅ Host Info geladen:', hostName.textContent);

  } catch (error) {
    console.error('❌ Fehler beim Laden:', error);
    setPlaceholderHost();
  }
}

// ========================================
// PLATZHALTER HOST
// ========================================
function setPlaceholderHost() {
  document.getElementById('host-avatar').src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Host';
  document.getElementById('host-name').textContent = 'Host';
}

// ========================================
// BENACHRICHTIGUNG ANZEIGEN
// ========================================
function showNotification(message, type = 'info') {
  console.log('🔔', message);

  const notification = document.createElement('div');
  notification.className = 'notification';
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
    padding: 15px 25px;
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
    z-index: 200;
    font-weight: 600;
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(400px)';
    notification.style.transition = 'all 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  console.log('👂 Setup Event Listeners...');

  const startBtn = document.getElementById('start-quiz-btn');
  if (startBtn && isHost) {
    startBtn.addEventListener('click', function() {
      console.log('🎮 Quiz wird gestartet...');

      // Broadcast an alle Spieler
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
}

// ========================================
// QUIZ STARTEN
// ========================================
function startQuiz() {
  console.log('🎮 Quiz startet jetzt!');
  showNotification('Quiz startet! 🎮', 'success');

  // Hier kommt die Quiz-Logik
  setTimeout(() => {
    alert('Quiz-Modus wird bald implementiert!');
  }, 1000);
}

// ========================================
// FULLSCREEN
// ========================================
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Fullscreen fehlgeschlagen:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// ========================================
// CSS ANIMATION HINZUFÜGEN
// ========================================
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(400px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(style);

console.log('✅ P2P Lobby-Script geladen!');

