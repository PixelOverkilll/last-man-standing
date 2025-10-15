// ========================================
// NEUE LOBBY - SAUBER UND EINFACH
// ========================================

console.log('🎮 Lobby lädt...');

// Globale Variablen
let isHost = false;
let lobbyCode = '';
let players = [];

// ========================================
// INITIALISIERUNG
// ========================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM geladen');

  // Prüfe URL-Parameter
  const urlParams = new URLSearchParams(window.location.search);
  lobbyCode = urlParams.get('code') || localStorage.getItem('lobbyCode') || 'ABC123';

  // Prüfe ob User Host ist
  isHost = localStorage.getItem('isHost') === 'true';

  console.log('🔍 Lobby Code:', lobbyCode);
  console.log('🔍 Ist Host:', isHost);

  // Lade Discord User
  const storedUser = localStorage.getItem('discordUser');
  console.log('🔍 Discord User:', storedUser ? 'Gefunden ✅' : 'Nicht gefunden ❌');

  // Initialisiere UI
  initUI();

  // Event Listeners
  setupEventListeners();
});

// ========================================
// UI INITIALISIERUNG
// ========================================
function initUI() {
  console.log('🎨 Initialisiere UI...');

  // Setze Lobby-Code
  document.getElementById('lobby-code-display').textContent = lobbyCode;

  // Zeige/Verstecke Lobby-Code basierend auf Host-Status
  const lobbyCodeContainer = document.getElementById('lobby-code-container');
  if (isHost) {
    lobbyCodeContainer.style.display = 'flex';
    console.log('✅ Lobby-Code wird angezeigt (Host)');
  } else {
    lobbyCodeContainer.style.display = 'none';
    console.log('🔒 Lobby-Code versteckt (Spieler)');
  }

  // Zeige/Verstecke Start-Button basierend auf Host-Status
  const hostControls = document.getElementById('host-controls');
  if (isHost) {
    hostControls.style.display = 'block';
    console.log('✅ Start-Button wird angezeigt (Host)');
  } else {
    hostControls.style.display = 'none';
    console.log('🔒 Start-Button versteckt (Spieler)');
  }

  // Lade Host-Info
  loadHostInfo();

  // Lade aktuelle Spieler
  if (!isHost) {
    addCurrentUserAsPlayer();
  }
}

// ========================================
// HOST INFO LADEN
// ========================================
function loadHostInfo() {
  console.log('🏠 Lade Host Info...');

  const storedUser = localStorage.getItem('discordUser');

  if (!storedUser) {
    console.warn('⚠️ Kein Discord User im localStorage!');
    setPlaceholderHost();
    return;
  }

  try {
    const user = JSON.parse(storedUser);
    console.log('✅ User geladen:', user.username);

    // Setze Avatar
    const hostAvatar = document.getElementById('host-avatar');
    const hostName = document.getElementById('host-name');

    if (user.avatar) {
      const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
      hostAvatar.src = avatarUrl;
      console.log('🖼️ Avatar URL:', avatarUrl);
    } else {
      const defaultAvatarNum = parseInt(user.discriminator || '0') % 5;
      hostAvatar.src = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNum}.png`;
      console.log('🖼️ Default Avatar gesetzt');
    }

    hostName.textContent = user.global_name || user.username;
    console.log('✅ Host Name:', hostName.textContent);

  } catch (error) {
    console.error('❌ Fehler beim Parsen des Users:', error);
    setPlaceholderHost();
  }
}

// ========================================
// PLATZHALTER HOST
// ========================================
function setPlaceholderHost() {
  console.log('🎭 Setze Platzhalter Host...');
  document.getElementById('host-avatar').src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Host&backgroundColor=b6e3f4';
  document.getElementById('host-name').textContent = 'Host';
}

// ========================================
// SPIELER HINZUFÜGEN
// ========================================
function addCurrentUserAsPlayer() {
  if (isHost) return; // Host ist kein Spieler

  console.log('👤 Füge aktuellen User als Spieler hinzu...');

  const storedUser = localStorage.getItem('discordUser');
  if (!storedUser) {
    console.warn('⚠️ Kein Discord User für Spieler gefunden');
    return;
  }

  try {
    const user = JSON.parse(storedUser);

    const player = {
      id: user.id,
      name: user.global_name || user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`,
      score: 0
    };

    addPlayerToDOM(player);
    console.log('✅ Spieler hinzugefügt:', player.name);

  } catch (error) {
    console.error('❌ Fehler beim Hinzufügen des Spielers:', error);
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
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  console.log('👂 Setup Event Listeners...');

  // Start Button
  const startBtn = document.getElementById('start-quiz-btn');
  if (startBtn) {
    startBtn.addEventListener('click', function() {
      console.log('🎮 Quiz wird gestartet...');
      alert('Quiz-Start-Funktion kommt bald!');
    });
  }

  // Fullscreen Button
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);
  }
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

console.log('✅ Lobby-Script geladen!');

