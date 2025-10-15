// ========================================
// LOBBY SYSTEM - NEU & EINFACH (OHNE P2P)
// ========================================

console.log('🎮 Lobby System lädt...');

// Globale Variablen
let isHost = false;
let lobbyCode = '';
let players = [];
let currentUser = null;

// Simulierte Lobby-Daten (später mit Backend ersetzen)
const lobbyStorage = {
  save: function(code, data) {
    localStorage.setItem('lobby_' + code, JSON.stringify(data));
  },
  load: function(code) {
    const data = localStorage.getItem('lobby_' + code);
    return data ? JSON.parse(data) : null;
  },
  delete: function(code) {
    localStorage.removeItem('lobby_' + code);
  }
};

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

  // Lade User-Daten
  loadCurrentUser();

  // UI initialisieren
  initUI();
  setupEventListeners();

  if (isHost) {
    initializeAsHost();
  } else {
    joinAsPlayer();
  }

  // Auto-Update alle 2 Sekunden
  setInterval(updateLobby, 2000);
});

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
// HOST INITIALISIERUNG
// ========================================
function initializeAsHost() {
  console.log('🏠 Initialisiere als HOST');
  showNotification('Lobby wird erstellt...', 'info', 1500);

  // Erstelle Lobby-Daten
  const lobbyData = {
    code: lobbyCode,
    host: {
      id: currentUser.id,
      name: currentUser.global_name || currentUser.username,
      avatar: getUserAvatar(currentUser)
    },
    players: [],
    createdAt: Date.now()
  };

  // Speichere Lobby
  lobbyStorage.save(lobbyCode, lobbyData);

  // Zeige Host-Info
  displayHostInfo(lobbyData.host);

  showNotification('✅ Lobby bereit!', 'success', 2000);
}

// ========================================
// ALS SPIELER BEITRETEN
// ========================================
function joinAsPlayer() {
  console.log('👤 Trete Lobby bei als SPIELER');
  showNotification('Trete Lobby bei...', 'info', 1500);

  // Lade Lobby-Daten
  const lobbyData = lobbyStorage.load(lobbyCode);

  if (!lobbyData) {
    showNotification('❌ Lobby nicht gefunden!', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
    return;
  }

  // Zeige Host-Info
  displayHostInfo(lobbyData.host);

  // Füge Spieler hinzu
  const playerData = {
    id: currentUser.id,
    name: currentUser.global_name || currentUser.username,
    avatar: getUserAvatar(currentUser),
    score: 0,
    joinedAt: Date.now()
  };

  // Prüfe ob Spieler bereits existiert
  const existingPlayerIndex = lobbyData.players.findIndex(p => p.id === playerData.id);
  if (existingPlayerIndex === -1) {
    lobbyData.players.push(playerData);
    lobbyStorage.save(lobbyCode, lobbyData);
    showNotification('✅ Lobby beigetreten!', 'success', 2000);
  } else {
    showNotification('✅ Willkommen zurück!', 'success', 2000);
  }

  updatePlayerList(lobbyData.players);
}

// ========================================
// LOBBY AKTUALISIEREN
// ========================================
function updateLobby() {
  const lobbyData = lobbyStorage.load(lobbyCode);

  if (!lobbyData) {
    console.warn('⚠️ Lobby nicht mehr vorhanden');
    return;
  }

  // Aktualisiere Spielerliste
  updatePlayerList(lobbyData.players);
}

// ========================================
// HOST INFO ANZEIGEN
// ========================================
function displayHostInfo(host) {
  const hostAvatar = document.getElementById('host-avatar');
  const hostName = document.getElementById('host-name');

  if (hostAvatar && hostName) {
    hostAvatar.src = host.avatar;
    hostName.textContent = host.name;
  }
}

// ========================================
// SPIELERLISTE AKTUALISIEREN
// ========================================
function updatePlayerList(newPlayers) {
  players = newPlayers;
  const playersContainer = document.getElementById('players-container');
  playersContainer.innerHTML = '';

  players.forEach(player => {
    addPlayerToDOM(player);
  });
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
  document.getElementById('lobby-code-display').textContent = lobbyCode;
  const lobbyCodeContainer = document.getElementById('lobby-code-container');
  const hostControls = document.getElementById('host-controls');

  if (isHost) {
    lobbyCodeContainer.style.display = 'flex';
    hostControls.style.display = 'block';
  } else {
    lobbyCodeContainer.style.display = 'none';
    hostControls.style.display = 'none';
  }
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  const startBtn = document.getElementById('start-quiz-btn');
  if (startBtn && isHost) {
    startBtn.addEventListener('click', function() {
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

  // Entferne Spieler aus Lobby
  const lobbyData = lobbyStorage.load(lobbyCode);
  if (lobbyData) {
    if (isHost) {
      // Host verlässt = Lobby wird gelöscht
      lobbyStorage.delete(lobbyCode);
    } else {
      // Spieler entfernen
      lobbyData.players = lobbyData.players.filter(p => p.id !== currentUser.id);
      lobbyStorage.save(lobbyCode, lobbyData);
    }
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
    alert('Quiz-Modus kommt bald!');
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

console.log('✅ Lobby System geladen!');

