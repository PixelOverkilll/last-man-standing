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
// SOCKET.IO (statt P2P) - Lobby Funktionen
// ========================================
let socket = window.__LMS_SOCKET || null;
let _socketHandlersAttached = false;

function ensureSocket() {
  if (socket) return socket;
  socket = io();
  window.__LMS_SOCKET = socket;
  attachSocketHandlers();
  return socket;
}

function attachSocketHandlers() {
  if (!socket || _socketHandlersAttached) return;
  _socketHandlersAttached = true;

  socket.on('connect', () => {
    console.log('[socket] verbunden mit', socket.id);
  });

  socket.on('lobby-state', (data) => {
    console.log('[socket] lobby-state', data);
    // Setze Host-Info
    if (data.host) displayHostInfo(data.host);
    // Füge alle Spieler hinzu
    if (Array.isArray(data.players)) {
      players.clear();
      document.querySelectorAll('[id^="player-"]').forEach(el => el.remove());
      data.players.forEach(p => {
        players.set(p.id, p);
        addPlayerToDOM(p);
      });
    }
  });

  socket.on('player-joined', (payload) => {
    const p = payload.player;
    console.log('[socket] player-joined', p);
    if (!players.has(p.id)) {
      players.set(p.id, p);
      addPlayerToDOM(p);
      showNotification(`✅ ${p.name} ist beigetreten`, 'success', 2000);
    }
  });

  socket.on('player-left', (payload) => {
    const id = payload.playerId;
    console.log('[socket] player-left', id);
    if (players.has(id)) {
      const p = players.get(id);
      players.delete(id);
      removePlayerFromDOM(id);
      showNotification(`❌ ${p.name} hat die Lobby verlassen`, 'info', 2000);
    }
  });

  socket.on('lobby-closed', () => {
    showNotification('ℹ️ Lobby wurde geschlossen', 'info', 2500);
    setTimeout(() => window.location.href = 'index.html', 1500);
  });

  socket.on('eval', (data) => {
    if (!isHost) {
      const duration = data.duration || 300;
      const color = data.result === 'correct' ? 'rgba(57, 255, 20, 0.3)' : 'rgba(255, 0, 0, 0.3)';
      showEvalOverlay(color, duration);
    }
  });

  socket.on('score-update', (data) => {
    console.log('[socket] score-update', data);
    const p = players.get(data.playerId);
    if (p) {
      p.score = data.score;
      players.set(data.playerId, p);
      updatePlayerScoreInDOM(data.playerId, data.score);
    } else {
      const newP = { id: data.playerId, name: data.name || 'Spieler', avatar: data.avatar || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + data.playerId), score: data.score };
      players.set(data.playerId, newP);
      addPlayerToDOM(newP);
    }
  });

  socket.on('game-start', (data) => {
    showNotification('🎮 Quiz startet!', 'success', 2000);
    // Weitere Start-Logik kann hier folgen
  });
}

// Host erstellt Lobby
async function createLobby(code) {
  ensureSocket();
  return new Promise((resolve, reject) => {
    const playerMeta = currentUser ? { id: currentUser.id || socket.id, name: currentUser.global_name || currentUser.username, avatar: getUserAvatar(currentUser), score: 0, isHost: true } : { id: socket.id, name: 'Host', avatar: '', isHost: true };

    socket.emit('create-lobby', { lobbyId: code, player: playerMeta }, (res) => {
      if (!res || !res.ok) {
        console.error('Lobby konnte nicht erstellt werden', res);
        return reject(res);
      }

      isHost = true;
      lobbyCode = res.lobbyId || code;
      players.clear();
      // Host not included in players list on server by default; add host locally if desired
      players.set(socket.id, playerMeta);
      displayHostInfo(playerMeta);
      localStorage.setItem('lobbyCode', lobbyCode);
      localStorage.setItem('isHost', 'true');
      console.log('Lobby erstellt', lobbyCode);

      // Aktualisiere UI mit dem neuen Code
      try { updateLobbyCodeDisplay(lobbyCode); } catch (e) { /* ignore */ }

      // Show a generic success notification (do not expose code in the toast)
      try { showNotification('✅ Lobby erfolgreich erstellt', 'success', 2500); } catch(e){}

      resolve(lobbyCode);
    });
  });
}

// Spieler tritt Lobby bei
async function joinLobby(code) {
  ensureSocket();
  return new Promise((resolve, reject) => {
    const id = (currentUser && currentUser.id) ? currentUser.id : undefined;
    const playerMeta = {
      id: id || undefined,
      name: (currentUser && (currentUser.global_name || currentUser.username)) || ('Spieler_' + Math.random().toString(36).slice(2,6)),
      avatar: currentUser ? getUserAvatar(currentUser) : ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + Math.random()),
      score: 0,
      isHost: false
    };

    socket.emit('join-lobby', { lobbyId: code, player: playerMeta }, (res) => {
      if (!res || !res.ok) {
        console.error('Lobby join failed', res);
        return reject(res);
      }

      isHost = false;
      lobbyCode = code;
      localStorage.setItem('lobbyCode', lobbyCode);
      localStorage.setItem('isHost', 'false');
      console.log('Erfolgreich der Lobby beigetreten', lobbyCode);

      // Aktualisiere UI mit dem Code (falls angezeigt)
      try { updateLobbyCodeDisplay(lobbyCode); } catch (e) { /* ignore */ }

      resolve(res);
    });
  });
}

// Nachricht an alle Spieler senden (Host)
function broadcast(data, excludeId = null) {
  if (!isHost) {
    // Spieler senden Relay-Message zum Server
    const payload = { lobbyId: lobbyCode, type: data.type || 'lobby-event', data: data };
    ensureSocket().emit('lobby-message', payload);
    return;
  }

  // Host: sende Nachricht an Server zur Verteilung
  const payload = { lobbyId: lobbyCode, type: data.type || 'lobby-event', data: data };
  ensureSocket().emit('lobby-message', payload);
}

// Nachricht an Host senden (Spieler)
function sendToHost(data) {
  const payload = { lobbyId: lobbyCode, type: data.type || 'to-host', data: data, target: 'host' };
  ensureSocket().emit('lobby-message', payload);
}

// Lobby-Code generieren (falls benötigt)
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
      // Zeige nur generische Erfolgsmeldung statt den Code in der Notification
      showNotification('✅ Lobby erfolgreich erstellt', 'success', 3000);
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

// Nach dem Setzen des Lobby-Codes:
function updateLobbyCodeDisplay(code) {
  const codeDisplay = document.getElementById('lobby-code-display');
  if (codeDisplay) codeDisplay.textContent = code;
}

// Kopierfunktion für den Lobby-Code — nutzt Clipboard API mit Fallback
function copyLobbyCode() {
  try {
    const codeEl = document.getElementById('lobby-code-display');
    if (!codeEl) return;
    const text = (codeEl.textContent || codeEl.innerText || '').trim();
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showNotification('✅ Lobby-Code kopiert', 'success', 1500);
      }).catch(() => {
        // fallback to older method
        fallbackCopyTextToClipboard(text);
      });
    } else {
      fallbackCopyTextToClipboard(text);
    }
  } catch (e) {
    console.error('copyLobbyCode error', e);
  }
}

function fallbackCopyTextToClipboard(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    // Prevent scrolling to bottom
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.padding = '0';
    ta.style.border = 'none';
    ta.style.outline = 'none';
    ta.style.boxShadow = 'none';
    ta.style.background = 'transparent';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    try {
      const ok = document.execCommand('copy');
      if (ok) showNotification('✅ Lobby-Code kopiert', 'success', 1500);
      else showNotification('⚠️ Kopieren fehlgeschlagen', 'error', 1800);
    } catch (err) {
      console.error('Fallback copy failed', err);
      showNotification('⚠️ Kopieren fehlgeschlagen', 'error', 1800);
    }

    ta.remove();
  } catch (e) {
    console.error('fallbackCopyTextToClipboard error', e);
  }
}

// Join-Funktion über Eingabefeld
function joinLobbyByInput() {
  const input = document.getElementById('join-code-input');
  if (input && input.value) {
    joinLobby(input.value.trim());
  }
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

  // Setze den Code (falls bereits vorhanden)
  try { updateLobbyCodeDisplay(lobbyCode); } catch (e) {}

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

  if (socket && lobbyCode) {
    ensureSocket().emit('leave-lobby', { lobbyId: lobbyCode }, (res) => {
      // ignore response
    });
  }

  // lokale Aufräumarbeiten
  if (isHost) {
    connections.forEach((conn) => conn.close && conn.close());
    connections.clear();
  } else if (hostConnection && hostConnection.close) {
    hostConnection.close();
  }

  try { if (socket) socket.disconnect(); } catch (e) {}
  socket = null;

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
