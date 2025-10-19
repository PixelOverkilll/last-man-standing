// ========================================
// LOBBY SYSTEM - MIT WEB SOCKET
// ========================================

console.log('🎮 Lobby System mit WebSocket lädt...');

// Globale Variablen
let isHost = false;
let lobbyCode = '';
let currentUser = null;
let players = new Map(); // playerId -> playerData
let socket = null;

// Verbindung zum WebSocket-Server herstellen
function connectToServer() {
  socket = io('https://last-man-standing-1.onrender.com');

  socket.on('connect', () => {
    console.log('Mit WebSocket-Server verbunden:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Verbindung zum WebSocket-Server verloren.');
  });

  socket.on('lobby-update', (data) => {
    console.log('Lobby-Update erhalten:', data);
    players = new Map(data.players);
    updatePlayerListUI();
  });
}

// Lobby erstellen
function createLobby(code) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      return reject(new Error('socket-not-connected'));
    }

    // Build player metadata from currentUser or fallback
    const playerMeta = currentUser ? {
      id: currentUser.id || socket.id,
      name: currentUser.global_name || currentUser.username || 'Host',
      avatar: (currentUser && getUserAvatar) ? getUserAvatar(currentUser) : '',
      score: 0,
      isHost: true
    } : { id: socket.id, name: 'Host', avatar: '', score: 0, isHost: true };

    const payload = { lobbyId: code, player: playerMeta };
    socket.emit('create-lobby', payload, (response) => {
      if (response && response.ok) {
        isHost = true;
        lobbyCode = response.lobbyId || code;
        try { updateLobbyCodeUI(); } catch(e){}
        console.log('Lobby erstellt (server ack):', lobbyCode);
        resolve(response);
      } else if (response && response.lobbyId) {
        // some server variants return lobbyId even without ok flag
        isHost = true;
        lobbyCode = response.lobbyId;
        try { updateLobbyCodeUI(); } catch(e){}
        resolve(response);
      } else {
        const err = (response && response.error) ? new Error(response.error) : new Error('create-lobby-failed');
        reject(err);
      }
    });
  });
}

// Lobby beitreten
function joinLobby(code) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) return reject(new Error('socket-not-connected'));

    // Build player metadata from currentUser or fallback
    const playerMeta = currentUser ? {
      id: currentUser.id || socket.id,
      name: currentUser.global_name || currentUser.username || 'Spieler',
      avatar: (currentUser && getUserAvatar) ? getUserAvatar(currentUser) : '',
      score: 0,
      isHost: false
    } : { id: socket.id, name: 'Spieler', avatar: '', score: 0, isHost: false };

    const payload = { lobbyId: code, player: playerMeta };
    socket.emit('join-lobby', payload, (response) => {
      if (response && response.ok) {
        isHost = false;
        lobbyCode = code;
        try { updateLobbyCodeUI(); } catch(e){}
        console.log('Lobby beigetreten (server ack):', lobbyCode);
        resolve(response);
      } else {
        const err = (response && response.error) ? new Error(response.error) : new Error('join-lobby-failed');
        reject(err);
      }
    });
  });
}

// Spieler-Liste in der UI aktualisieren
function updatePlayerListUI() {
  // Implementiere die Logik, um die Spieler-Liste in der Benutzeroberfläche zu aktualisieren
}

// Lobby-Code in der UI aktualisieren
function updateLobbyCodeUI() {
  // Implementiere die Logik, um den Lobby-Code in der Benutzeroberfläche anzuzeigen
}

// Verbindung herstellen, wenn das Skript geladen wird
connectToServer();


// ========================================
// CURRENT USER LADEN - Fallback-Implementierung
function loadCurrentUser() {
  try {
    const storedUser = localStorage.getItem('discordUser');
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      console.log('👤 User geladen:', currentUser.global_name || currentUser.username || '<unknown>');
      return true;
    } else {
      console.warn('❌ Kein User im localStorage gefunden (discordUser)');
      currentUser = null;
      return false;
    }
  } catch (e) {
    console.error('Fehler beim Laden des Users aus localStorage:', e);
    currentUser = null;
    return false;
  }
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

  // Wenn wir Host sind, versuche optimistisch den Host-Player aus localStorage zu laden
  if (isHost) {
    try {
      const storedHost = localStorage.getItem('hostPlayer');
      if (storedHost) {
        const hostPlayer = JSON.parse(storedHost);
        // füge Host in players map ein, damit UI sofort den Host zeigt
        if (hostPlayer && hostPlayer.id) {
          players.set(hostPlayer.id, hostPlayer);
          try { addPlayerToDOM(hostPlayer); } catch (e) { console.warn('addPlayerToDOM failed for hostPlayer', e); }
          try { displayHostInfo(hostPlayer); } catch (e) { /* ignore if function not present */ }
        }
      }
    } catch (e) {
      console.warn('Could not read hostPlayer from localStorage', e);
    }
  }

  // Reagiere auf Änderungen in localStorage (z.B. anderes Tab ändert Auswahl)
  window.addEventListener('storage', (evt) => {
    if (evt.key === 'backgroundStyle') {
      applySavedBackground();
    }
  });

  // Initialisiere UI
  initUI();
  setupEventListeners();

  // Starte WebSocket-Verbindung
  try {
    connectToServer();
    if (isHost) {
      // Host verwendet den Code aus der URL
      // Guard: ensure we only attempt to create the lobby once per page load
      if (!window.__LMS_CREATING_LOBBY) {
        window.__LMS_CREATING_LOBBY = true;

        // Zeige den Lobby-Code sofort, damit der Host ihn sieht (optimistische UI)
        try { updateLobbyCodeDisplay(lobbyCode); } catch(e){}
        try { showNotification('🔧 Lobby wird erstellt... (falls erforderlich wird erneut versucht)', 'info', 1800); } catch(e){}

        // Versuche die Lobby sicher zu erstellen mit ein paar Versuchen
        const createWithRetry = async (code, attempts = 5, delay = 700) => {
          for (let i = 1; i <= attempts; i++) {
            try {
              console.log(`Erstelle Lobby (Versuch ${i}/${attempts}):`, code);
              await createLobby(code);
              console.log('Lobby erfolgreich erstellt auf Server:', code);
              return true;
            } catch (err) {
              console.warn('createLobby fehlgeschlagen', err);
              if (i >= attempts) throw err;
              await new Promise(r => setTimeout(r, delay + Math.floor(Math.random()*200)));
            }
          }
        };

        try {
          await createWithRetry(lobbyCode);
        } catch (err) {
          console.error('Lobby konnte nicht erstellt werden nach mehreren Versuchen:', err);
          showNotification('❌ Lobby-Erstellung fehlgeschlagen. Bitte Seite neu laden oder andere Verbindung prüfen.', 'error', 4000);
          // allow retry by clearing guard so user can try again after reload
          window.__LMS_CREATING_LOBBY = false;
          throw err;
        }
      } else {
        console.log('Lobby-Erstellung bereits in Arbeit, überspringe neuen Start');
      }
      displayHostInfo();
      // createLobby already handled above and will show notifications; persist state
      localStorage.setItem('lobbyCode', lobbyCode);
      console.log('✅ Host-Lobby bereit (oder Erstellversuch läuft). Warte auf Spieler...');
    } else {
      console.log('🔗 Versuche Lobby beizutreten:', lobbyCode);
      // Use retry wrapper to handle short timing races
      await joinLobbyWithRetry(lobbyCode);
      console.log('✅ Client erfolgreich verbunden');
    }
  } catch (error) {
    console.error('❌ WebSocket-Verbindung fehlgeschlagen:', error);
    showNotification('❌ Verbindung fehlgeschlagen', 'error', 3000);
    setTimeout(() => window.location.href = 'index.html', 3000);
  }
});

// Retry wrapper for joinLobby to handle short race conditions where host hasn't registered lobby on server yet
async function joinLobbyWithRetry(code, maxAttempts = 6, delayMs = 800) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      attempt++;
      console.log(`Versuche beizutreten (Versuch ${attempt}/${maxAttempts})`, code);
      const res = await joinLobby(code);
      console.log('Beitritt erfolgreich', res);
      return res;
    } catch (err) {
      console.warn('Join-Versuch fehlgeschlagen', err, '— warte und versuche erneut');
      // If server explicitly says lobby-not-found, we retry. For other errors we can also retry a few times.
      if (attempt >= maxAttempts) {
        throw err;
      }
      // Backoff with jitter
      const jitter = Math.floor(Math.random() * 250);
      await new Promise(r => setTimeout(r, delayMs + jitter));
    }
  }
  throw new Error('joinLobbyWithRetry exhausted');
}

// ========================================
// DOM FUNKTIONEN
// ========================================
function addPlayerToDOM(player) {
  // Defensive defaults to avoid rendering 'undefined'
  if (!player) return;
  // Ensure minimal shape
  const id = player.id || (player.socketId || player.playerId) || ('p_' + Math.random().toString(36).slice(2,8));
  const name = (player.name === undefined || player.name === null || player.name === '') ? (player.username || 'Spieler') : player.name;
  const avatar = player.avatar || (player.id ? ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + id) : 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Math.random());
  const score = (typeof player.score === 'number') ? player.score : (player.score ? Number(player.score) : 0);
  const isHostFlag = !!player.isHost;

  // If element already exists, update it instead of re-creating
  const existing = document.getElementById('player-' + id);
  if (existing) {
    // update avatar, name, score
    const img = existing.querySelector('.player-avatar');
    if (img) img.src = avatar;
    const nameEl = existing.querySelector('.player-name');
    if (nameEl) nameEl.textContent = name + (isHostFlag ? ' 👑' : '');
    const scoreEl = existing.querySelector('.player-score');
    if (scoreEl) scoreEl.textContent = `${score} Punkte`;
    return;
  }

  const container = document.getElementById('players-container');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'player-card';
  card.id = 'player-' + id;
  card.innerHTML = `
    <img src="${avatar}" alt="${name}" class="player-avatar">
    <span class="player-name">${name}${isHostFlag ? ' \ud83d\udc51' : ''}</span>
    <span class="player-score">${score} Punkte</span>
  `;

  container.appendChild(card);

  // Apply color extraction safely
  extractDominantColor(avatar, (color) => {
    try { applyPlayerColor(card, color); } catch (e) { /* ignore color failures */ }
  });

  // Host kann Spieler auswählen (Klick auf Karte)
  card.addEventListener('click', () => {
    if (!isHost) return;
    selectPlayerForPoints(id);
  });

  console.log('\u2795 Spieler zur DOM hinzugef\u00fcgt:', name, id);
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
  const container = document.getElementById('lobby-code-container');
  const teaser = document.getElementById('lobby-code-teaser');
  const copyCodeBtn = document.getElementById('copy-code-btn');
  const copyLinkBtn = document.getElementById('copy-link-btn');

  if (codeDisplay) codeDisplay.textContent = code || '------';

  if (!container) return;

  // Make container visible for both hosts and clients; we control internal visibility separately
  container.classList.add('lobby-code-visible');
  container.style.display = 'flex';

  // Hosts sehen den vollständigen Code und beide Buttons
  if (isHost && code) {
    if (codeDisplay) { codeDisplay.style.visibility = 'visible'; codeDisplay.textContent = code; }
    if (teaser) teaser.style.display = 'none';
    if (copyCodeBtn) copyCodeBtn.style.display = 'inline-block';
    if (copyLinkBtn) copyLinkBtn.style.display = 'inline-block';
  } else {
    // Clients sehen einen Teaser und nur den Link-Kopieren Button (kein direkter Code)
    if (codeDisplay) { codeDisplay.style.visibility = 'hidden'; codeDisplay.textContent = '------'; }
    if (teaser) teaser.style.display = 'inline-block';
    if (copyCodeBtn) copyCodeBtn.style.display = 'none';
    if (copyLinkBtn) copyLinkBtn.style.display = 'inline-block';
  }
}

// Kopierfunktion für den Lobby-Code — nutzt Clipboard API mit Fallback
function copyLobbyCode() {
  try {
    if (!isHost) return; // nur Host darf Code direkt kopieren
    const codeEl = document.getElementById('lobby-code-display');
    if (!codeEl) return;
    const text = (codeEl.textContent || codeEl.innerText || '').trim();
    if (!text || text === '------') return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showNotification('✅ Lobby-Code kopiert', 'success', 1500);
        const btn = document.getElementById('copy-code-btn'); if (btn) showCopyTooltip(btn, 'Kopiert!');
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

// Kopiert die vollständige Lobby-URL (mit ?code=) — für Host & Clients verfügbar
function copyLobbyLink() {
  try {
    if (!lobbyCode) return;
    const url = new URL(window.location.href);
    // Verwende aktuellen Pfad und setze code param
    url.searchParams.set('code', lobbyCode);
    // Entferne mögliche andere, für Sicherheit: nur origin + pathname + params + hash
    const fullUrl = url.origin + url.pathname + '?' + url.searchParams.toString() + (url.hash || '');

    const btn = document.getElementById('copy-link-btn');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        showNotification('✅ Lobby-Link kopiert', 'success', 1500);
        if (btn) showCopyTooltip(btn, 'Link kopiert!');
      }).catch(() => {
        fallbackCopyTextToClipboard(fullUrl);
      });
    } else {
      fallbackCopyTextToClipboard(fullUrl);
    }
  } catch (e) {
    console.error('copyLobbyLink error', e);
  }
}

// Accessibility: announce changes for screen-readers
function announceForA11y(message) {
  try {
    const el = document.getElementById('a11y-status');
    if (el) {
      el.textContent = '';
      // small delay to ensure assistive tech notices change
      setTimeout(() => { el.textContent = message; }, 50);
    }
  } catch (e) { console.warn('announceForA11y failed', e); }
}

function isSmallScreen() {
  try { return window.matchMedia && window.matchMedia('(max-width: 600px)').matches; } catch (e) { return false; }
}

// Enhanced tooltip: on small screens, use notification + a11y announce; on desktop show visual tooltip
function showCopyTooltip(button, text) {
  try {
    if (!button) {
      // fallback to notification
      showNotification(text || 'Kopiert', 'success', 1400);
      announceForA11y(text || 'Kopiert');
      return;
    }

    if (isSmallScreen()) {
      // Mobile: use non-blocking notification + a11y
      showNotification(text || 'Kopiert!', 'success', 1400);
      announceForA11y(text || 'Kopiert');
      return;
    }

    // Desktop: create a tooltip element attached to document
    const tip = document.createElement('div');
    tip.className = 'copy-tooltip';
    tip.textContent = text || 'Kopiert!';
    // Make tooltip aria-hidden for assistive tech (we announce separately)
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);

    // Position: prefer above button, centered
    const rect = button.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const tipWidth = 120; // approximate
    const left = Math.max(8, rect.left + rect.width / 2 - tipWidth / 2);
    const top = rect.top + scrollTop - 40; // ~above

    tip.style.position = 'absolute';
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.minWidth = '80px';
    tip.style.textAlign = 'center';
    tip.style.pointerEvents = 'none';
    tip.style.opacity = '0';
    tip.style.transform = 'translateY(6px)';
    tip.style.transition = 'transform 0.18s ease, opacity 0.18s ease';

    requestAnimationFrame(() => {
      tip.style.opacity = '1';
      tip.style.transform = 'translateY(0)';
    });

    // Announce for screen readers too
    announceForA11y(text || 'Kopiert');

    setTimeout(() => {
      tip.style.opacity = '0';
      tip.style.transform = 'translateY(-6px)';
      setTimeout(() => tip.remove(), 220);
    }, 1200);
  } catch (e) {
    console.error('showCopyTooltip error', e);
    try { showNotification(text || 'Kopiert!', 'success', 1200); announceForA11y(text || 'Kopiert'); } catch(e){}
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

  // Copy button wiring (accessible: click + keyboard)
  const copyCodeBtn = document.getElementById('copy-code-btn');
  const copyLinkBtn = document.getElementById('copy-link-btn');

  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', (e) => { e.preventDefault(); copyLobbyCode(); });
    copyCodeBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyLobbyCode(); } });
    copyCodeBtn.setAttribute('tabindex', '0');
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', (e) => { e.preventDefault(); copyLobbyLink(); });
    copyLinkBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyLobbyLink(); } });
    copyLinkBtn.setAttribute('tabindex', '0');
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

console.log('✅ Lobby System MIT WebSocket geladen!');

// --- Debug Overlay: zeigt wichtige Werte live an ---
(function createDebugOverlay() {
  try {
    const existing = document.getElementById('lobby-debug-overlay');
    if (existing) return;
    const dbg = document.createElement('div');
    dbg.id = 'lobby-debug-overlay';
    dbg.style.cssText = 'position:fixed;left:12px;bottom:12px;background:rgba(0,0,0,0.7);color:#fff;padding:10px 12px;border-radius:8px;font-size:12px;z-index:99999;min-width:220px;box-shadow:0 8px 30px rgba(0,0,0,0.6);backdrop-filter:blur(4px);';
    dbg.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px;color:#ffd966">Lobby Debug</div>
      <div id="dbg-socket">socket: -</div>
      <div id="dbg-lobby">lobbyCode: -</div>
      <div id="dbg-isHost">isHost: -</div>
      <div id="dbg-user">user: -</div>
    `;
    document.body.appendChild(dbg);

    window.__lms_debug_interval = setInterval(() => {
      const s = window.__LMS_SOCKET || (typeof socket !== 'undefined' ? socket : null);
      const socketStatus = s ? (s.connected ? 'connected' : ('disconnected (' + (s.io && s.io.transport ? s.io.transport.name : 'unknown') + ')')) : 'no-socket';
      const socketId = s && s.id ? s.id : '';
      const userLabel = currentUser ? (currentUser.global_name || currentUser.username || currentUser.id || '<user>') : 'none';
      const lobbyLabel = lobbyCode || '-';
      const isHostLabel = !!isHost;
      const elS = document.getElementById('dbg-socket'); if (elS) elS.textContent = `socket: ${socketStatus} ${socketId}`;
      const elL = document.getElementById('dbg-lobby'); if (elL) elL.textContent = `lobbyCode: ${lobbyLabel}`;
      const elH = document.getElementById('dbg-isHost'); if (elH) elH.textContent = `isHost: ${isHostLabel}`;
      const elU = document.getElementById('dbg-user'); if (elU) elU.textContent = `user: ${userLabel}`;
    }, 700);

    window.addEventListener('beforeunload', () => { try { clearInterval(window.__lms_debug_interval); } catch (e) {} });
  } catch (e) { /* non-fatal */ }
})();

