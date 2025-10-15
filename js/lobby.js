// Quiz Lobby JavaScript

// Quiz Questions
const quizQuestions = [
  {
    question: "Was ist die Hauptstadt von Deutschland?",
    answers: ["Berlin", "München", "Hamburg", "Frankfurt"],
    correctAnswer: 0
  },
  {
    question: "Welches ist das größte Tier der Welt?",
    answers: ["Elefant", "Blauwal", "Giraffe", "Weißer Hai"],
    correctAnswer: 1
  },
  {
    question: "Wie viele Kontinente gibt es auf der Erde?",
    answers: ["5", "6", "7", "8"],
    correctAnswer: 2
  }
];

// Players Array - LEER! Spieler werden dynamisch hinzugefügt
const players = [];

// Game State
let currentQuestion = 0;
let selectedAnswer = null;
let gameStarted = false;
let timerInterval = null;
let botSuggestions = {};
let voiceUsers = []; // Track users in voice channel
let isHost = false;
let lobbyCode = '';

document.addEventListener('DOMContentLoaded', function() {

  // Check URL for lobby code
  const urlParams = new URLSearchParams(window.location.search);
  const urlLobbyCode = urlParams.get('code');

  // Determine if user is host
  // User is HOST if they created the lobby (isHost flag from index.html)
  // User is PLAYER if they joined via lobby code (even if it's the same code)
  const wasHostFlagSet = localStorage.getItem('isHost') === 'true';
  const storedLobbyCode = localStorage.getItem('lobbyCode');

  if (urlLobbyCode) {
    // User opened lobby with code in URL
    lobbyCode = urlLobbyCode;

    // Check if this is the SAME lobby they created OR if host flag is set
    if (wasHostFlagSet && storedLobbyCode === urlLobbyCode) {
      // User created this lobby - they are the HOST
      isHost = true;
      localStorage.setItem('isHost', 'true'); // Keep the flag
      console.log('✅ Du bist der HOST dieser Lobby');
    } else if (wasHostFlagSet && !storedLobbyCode) {
      // User just created the lobby
      isHost = true;
      localStorage.setItem('isHost', 'true');
      console.log('✅ Du bist der HOST dieser Lobby (neu erstellt)');
    } else {
      // User joined via code - they are a PLAYER
      isHost = false;
      localStorage.setItem('isHost', 'false');
      console.log('👤 Du bist ein SPIELER in dieser Lobby');
    }

    localStorage.setItem('lobbyCode', lobbyCode);
  } else {
    // No code in URL - check existing session
    lobbyCode = localStorage.getItem('lobbyCode') || 'ABC123';
    isHost = localStorage.getItem('isHost') === 'true';
  }

  // WICHTIG: Setze das isHost-Flag BEVOR loadHostInfo() aufgerufen wird
  console.log('🔍 isHost gesetzt auf:', isHost);
  console.log('🔍 localStorage isHost:', localStorage.getItem('isHost'));

  // Load host info (NACH dem isHost-Flag gesetzt wurde)
  loadHostInfo();

  // Load players
  loadPlayers();

  // Check if user is host
  checkIfHost();

  // Setup event listeners
  setupEventListeners();

  // Setup fullscreen button
  setupFullscreen();

  // Check for Discord voice state
  checkDiscordVoiceState();

  // Add current user as player if not host
  addCurrentUserAsPlayer();

  // Load all players from voice channel (if host)
  if (isHost) {
    loadPlayersFromVoiceChannel();
  }
});

function loadHostInfo() {
  const storedUser = localStorage.getItem('discordUser');
  const currentLobbyCode = localStorage.getItem('lobbyCode') || 'ABC123';
  const isCurrentUserHost = localStorage.getItem('isHost') === 'true';

  console.log('🏠 Loading host info - isHost:', isCurrentUserHost);

  // If user is host, show their own info
  if (isCurrentUserHost && storedUser) {
    const user = JSON.parse(storedUser);
    const hostAvatar = document.getElementById('host-avatar');
    const hostName = document.getElementById('host-name');

    console.log('✅ User ist Host, zeige eigenes Profil:', user.username);

    // Set host avatar
    if (user.avatar) {
      const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
      hostAvatar.src = avatarUrl;

      // Extract and apply dominant color from avatar
      extractDominantColor(avatarUrl, (color) => {
        console.log('Extracted color from Discord avatar:', color);
        applyHostThemeColor(color);
      });
    } else {
      const defaultAvatarNum = parseInt(user.discriminator || '0') % 5;
      const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNum}.png`;
      hostAvatar.src = defaultAvatar;

      // Extract color from default avatar too
      extractDominantColor(defaultAvatar, (color) => {
        console.log('Extracted color from default avatar:', color);
        applyHostThemeColor(color);
      });
    }

    hostName.textContent = user.global_name || user.username;
  } else {
    // User is NOT host - try to load host info from voice channel users
    console.log('👤 User ist NICHT Host, versuche Host zu laden...');
    loadHostFromVoiceChannel();
  }

  // Set lobby code
  document.getElementById('lobby-code-display').textContent = currentLobbyCode;
}

// Load host info from voice channel (for players)
async function loadHostFromVoiceChannel() {
  try {
    const apiUrl = CONFIG.getGamenightUsersUrl();
    console.log('🔄 Lade Voice-Channel User um Host zu finden:', apiUrl);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('❌ Bot API nicht erreichbar - zeige Platzhalter');
      showPlaceholderHost();
      return;
    }

    const voiceUsers = await response.json();
    console.log('✅ Voice-Channel User geladen:', voiceUsers);

    // First user in voice is the host (or we could implement proper host tracking)
    if (voiceUsers.length > 0) {
      const hostUser = voiceUsers[0]; // First user = Host
      const hostAvatar = document.getElementById('host-avatar');
      const hostName = document.getElementById('host-name');

      console.log('🏠 Host gefunden:', hostUser.username);

      // Set host avatar
      const avatarUrl = hostUser.avatar
        ? `https://cdn.discordapp.com/avatars/${hostUser.id}/${hostUser.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(hostUser.discriminator || '0') % 5}.png`;

      hostAvatar.src = avatarUrl;
      hostName.textContent = hostUser.global_name || hostUser.username;

      // Extract and apply color
      extractDominantColor(avatarUrl, (color) => {
        applyHostThemeColor(color);
      });
    } else {
      console.log('⚠️ Keine User im Voice-Channel');
      showPlaceholderHost();
    }

  } catch (error) {
    console.error('❌ Fehler beim Laden des Hosts:', error);
    showPlaceholderHost();
  }
}

// Show placeholder host when real host can't be loaded
function showPlaceholderHost() {
  const testAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Host&backgroundColor=b6e3f4';
  document.getElementById('host-avatar').src = testAvatar;
  document.getElementById('host-name').textContent = 'Host';
  applyHostThemeColor('rgb(124, 58, 237)'); // Default purple
}

// Extract dominant color from image
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

    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }

    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);

    // Increase saturation for more vibrant colors
    const hsl = rgbToHsl(r, g, b);
    hsl[1] = Math.min(hsl[1] * 1.5, 1); // Increase saturation
    hsl[2] = Math.max(0.4, Math.min(hsl[2], 0.6)); // Adjust brightness

    const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
    const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

    callback(color);
  };

  img.onerror = function() {
    callback('#7c3aed'); // Fallback to purple
  };

  img.src = imageUrl;
}

// RGB to HSL conversion
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

// HSL to RGB conversion
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

// Apply theme color to host card
function applyHostThemeColor(color) {
  const hostCard = document.querySelector('.host-card');
  const hostLabel = document.querySelector('.host-label');
  const hostAvatar = document.querySelector('.host-avatar');
  const hostName = document.querySelector('.host-name');

  if (!hostCard) return;

  // Parse RGB values
  const rgb = color.match(/\d+/g).map(Number);
  const rgbaLight = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2)`;
  const rgbaMedium = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
  const rgbaStrong = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`;

  // Apply colors to container
  hostCard.style.borderColor = color;
  hostCard.style.boxShadow = `0 10px 30px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.4)`;

  // Apply colors to label
  hostLabel.style.background = rgbaStrong;
  hostLabel.style.borderBottom = `2px solid ${color}`;

  // Apply colors to avatar
  hostAvatar.style.borderColor = color;
  hostAvatar.style.boxShadow = `0 0 20px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.6)`;

  // Apply colors to name capsule
  if (hostName) {
    hostName.style.background = rgbaMedium;
    hostName.style.borderColor = color;
    hostName.style.boxShadow = `0 4px 15px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.4)`;
  }

  // Store color for later use (for speaking animation)
  hostAvatar.dataset.themeColor = color;
}

function loadPlayers() {
  const playersContainer = document.getElementById('players-container');
  playersContainer.innerHTML = '';

  players.forEach(player => {
    addPlayerToDOM(player);
  });

  // Update voice indicators for all players
  updateVoiceIndicators();
}

function addPlayerToDOM(player) {
  const playersContainer = document.getElementById('players-container');

  const playerCard = document.createElement('div');
  playerCard.className = 'player-card';
  playerCard.id = `player-${player.id}`;

  playerCard.innerHTML = `
    <img src="${player.avatar}" alt="${player.name}" class="player-avatar">
    <span class="player-name">${player.name}</span>
    <span class="player-score">${player.score} Punkte</span>
    ${player.inVoice ? '<div class="player-voice-indicator"></div>' : ''}
  `;

  playersContainer.appendChild(playerCard);

  // Apply theme color to new player card
  const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--user-theme-color').trim() || '#7c3aed';
  const rgb = themeColor.match(/\d+/g).map(Number);
  if (rgb && rgb.length >= 3) {
    playerCard.style.borderColor = themeColor;
    playerCard.style.boxShadow = `0 5px 20px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`;
  }
}

function addPlayer(player) {
  players.push(player);
  addPlayerToDOM(player);
}

function checkIfHost() {
  const isHost = localStorage.getItem('isHost') === 'true';

  if (isHost) {
    document.getElementById('host-controls').style.display = 'block';
  }
}

function setupEventListeners() {
  // Start Quiz Button
  const startBtn = document.getElementById('start-quiz-btn');
  if (startBtn) {
    startBtn.addEventListener('click', startQuiz);
  }

  // Answer Buttons
  const answerButtons = document.querySelectorAll('.answer-btn');
  answerButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      if (!this.disabled) {
        selectAnswer(this);
      }
    });
  });
}

// Fullscreen functionality
function setupFullscreen() {
  const fullscreenBtn = document.getElementById('fullscreen-btn');

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Update button icon when fullscreen changes
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    document.addEventListener('mozfullscreenchange', updateFullscreenButton);
    document.addEventListener('MSFullscreenChange', updateFullscreenButton);
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement &&
      !document.webkitFullscreenElement &&
      !document.mozFullScreenElement &&
      !document.msFullscreenElement) {
    // Enter fullscreen
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

function updateFullscreenButton() {
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    if (document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement) {
      fullscreenBtn.textContent = '⛶';
      fullscreenBtn.title = 'Vollbild verlassen';
    } else {
      fullscreenBtn.textContent = '⛶';
      fullscreenBtn.title = 'Vollbild';
    }
  }
}

// Discord Voice State Detection
function checkDiscordVoiceState() {
  const storedUser = localStorage.getItem('discordUser');

  if (!storedUser) {
    console.log('Kein Discord-User gefunden');
    return;
  }

  const user = JSON.parse(storedUser);

  // Starte regelmäßige Abfrage der Voice-States vom Discord Bot
  startVoiceStatePolling(user.id);
}

function startVoiceStatePolling(currentUserId) {
  let botOfflineWarningShown = false;

  // Prüfe Voice-States alle 2 Sekunden
  setInterval(async () => {
    try {
      // Nutze die konfigurierte Bot API URL (funktioniert lokal UND online)
      const apiUrl = CONFIG.getVoiceStatesUrl();
      console.log('🔄 Fetching voice states from:', apiUrl);

      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.error('❌ Bot API nicht erreichbar - Status:', response.status, response.statusText);

        // Zeige Warnung wenn Bot offline ist
        if (!botOfflineWarningShown) {
          updateBotOfflineStatus();
          botOfflineWarningShown = true;
        }
        return;
      }

      const voiceStates = await response.json();
      console.log('✅ Voice States erfolgreich geladen:', voiceStates);

      // Bot ist online, verstecke Warnung
      if (botOfflineWarningShown) {
        botOfflineWarningShown = false;
      }

      // Update voice states für alle User
      updateAllVoiceStates(voiceStates, currentUserId);

    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Voice-States:', error.message);
      console.error('❌ Vollständiger Fehler:', error);

      // Zeige Warnung wenn Bot nicht erreichbar ist
      if (!botOfflineWarningShown) {
        updateBotOfflineStatus();
        botOfflineWarningShown = true;
      }
    }
  }, 2000); // Alle 2 Sekunden aktualisieren

  // Starte Game-State-Polling (nur für Spieler, nicht für Host)
  startGameStatePolling();
}

// Game-State-Synchronisation
function startGameStatePolling() {
  // Prüfe Game-State alle 2 Sekunden (nur wenn Spieler, nicht Host)
  setInterval(async () => {
    const isHost = localStorage.getItem('isHost') === 'true';
    if (isHost) return; // Host braucht kein Polling

    try {
      const lobbyCode = localStorage.getItem('lobbyCode');
      if (!lobbyCode) return;

      const apiUrl = CONFIG.getGameStateUrl(lobbyCode);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.error('❌ Game State API nicht erreichbar');
        return;
      }

      const gameState = await response.json();
      console.log('🎮 Game State geladen:', gameState);

      // Wenn Host das Spiel gestartet hat, starte es auch beim Spieler
      if (gameState.started && !gameStarted) {
        console.log('🚀 Host hat das Spiel gestartet! Starte Quiz...');
        startQuiz();
      }

    } catch (error) {
      console.error('❌ Fehler beim Laden des Game State:', error);
    }
  }, 2000); // Alle 2 Sekunden prüfen
}

function updateBotOfflineStatus() {
  console.warn('⚠️ Discord Bot ist nicht erreichbar - Voice Status nicht verfügbar');

  // Update Debug Info
  const debugBotStatus = document.getElementById('debug-bot-status');
  if (debugBotStatus) {
    debugBotStatus.textContent = '❌ Offline';
    debugBotStatus.style.color = '#ef4444';
  }

  const debugInVoice = document.getElementById('debug-in-voice');
  if (debugInVoice) {
    debugInVoice.textContent = '⚠️ Bot offline';
    debugInVoice.style.color = '#f59e0b';
  }

  const debugMuted = document.getElementById('debug-muted');
  if (debugMuted) {
    debugMuted.textContent = '⚠️ Bot offline';
    debugMuted.style.color = '#f59e0b';
  }

  const debugSpeaking = document.getElementById('debug-speaking');
  if (debugSpeaking) {
    debugSpeaking.textContent = '⚠️ Bot offline';
    debugSpeaking.style.color = '#f59e0b';
  }
}

function updateAllVoiceStates(voiceStates, currentUserId) {
  console.log('🔍 Voice States vom Bot:', voiceStates);
  console.log('🔍 Meine User ID:', currentUserId);

  // Update Debug Info
  document.getElementById('debug-user-id').textContent = currentUserId || 'Nicht geladen';
  document.getElementById('debug-bot-status').textContent = '✅ Verbunden';
  document.getElementById('debug-bot-status').style.color = '#10b981';

  // Find current user's state (could be host OR player)
  const myState = voiceStates.find(state => state.userId === currentUserId);

  if (myState) {
    console.log('✅ Ich bin im Voice:', myState);

    // Update Debug Info
    document.getElementById('debug-in-voice').textContent = '✅ Ja';
    document.getElementById('debug-in-voice').style.color = '#10b981';
    document.getElementById('debug-muted').textContent = myState.muted ? '🔇 Ja' : '🎤 Nein';
    document.getElementById('debug-muted').style.color = myState.muted ? '#ef4444' : '#10b981';
    document.getElementById('debug-speaking').textContent = myState.speaking ? '🟢 Ja' : '⚪ Nein';
    document.getElementById('debug-speaking').style.color = myState.speaking ? '#10b981' : '#ef4444';

    // Update visual indicator based on role
    const isHost = localStorage.getItem('isHost') === 'true';
    if (isHost) {
      updateHostVoiceStatus(myState.speaking);
    } else {
      // Update player's own card in the players list
      updatePlayerVoiceStatus(currentUserId, true, myState.speaking);
    }
  } else {
    console.log('❌ Ich bin nicht im Voice gefunden');

    // Update Debug Info
    document.getElementById('debug-in-voice').textContent = '❌ Nein';
    document.getElementById('debug-in-voice').style.color = '#ef4444';
    document.getElementById('debug-muted').textContent = '-';
    document.getElementById('debug-muted').style.color = '#6b7280';
    document.getElementById('debug-speaking').textContent = '❌ Nein';
    document.getElementById('debug-speaking').style.color = '#ef4444';

    const isHost = localStorage.getItem('isHost') === 'true';
    if (isHost) {
      updateHostVoiceStatus(false);
    }
  }

  // Update ALL other players in the list
  players.forEach(player => {
    const playerState = voiceStates.find(state => state.userId === player.id);
    if (playerState) {
      updatePlayerVoiceStatus(player.id, true, playerState.speaking);
    } else {
      updatePlayerVoiceStatus(player.id, false, false);
    }
  });
}

function updateHostVoiceStatus(isSpeaking) {
  const hostAvatar = document.querySelector('.host-avatar');
  const hostVoiceIndicator = document.getElementById('host-voice-indicator');
  console.log('🎤 Update Host Avatar, speaking:', isSpeaking, 'Avatar gefunden:', !!hostAvatar);

  if (!hostAvatar || !hostVoiceIndicator) return;

  // Get theme color
  const themeColor = hostAvatar.dataset.themeColor || '#7c3aed';
  const rgb = themeColor.match(/\d+/g).map(Number);

  if (isSpeaking) {
    console.log('✅ Füge speaking class hinzu');
    hostAvatar.classList.add('speaking');
    hostAvatar.style.borderColor = '#10b981';
    hostAvatar.style.boxShadow = `0 0 30px rgba(16, 185, 129, 1), 0 0 60px rgba(16, 185, 129, 0.6)`;

    hostVoiceIndicator.style.display = 'flex';
    hostVoiceIndicator.classList.add('speaking');
    hostVoiceIndicator.classList.remove('muted');
    hostVoiceIndicator.querySelector('.voice-icon').textContent = '🎤';
  } else {
    console.log('❌ Entferne speaking class');
    hostAvatar.classList.remove('speaking');
    hostAvatar.style.borderColor = themeColor;
    hostAvatar.style.boxShadow = `0 0 20px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.6)`;

    hostVoiceIndicator.style.display = 'flex';
    hostVoiceIndicator.classList.remove('speaking');
    hostVoiceIndicator.classList.add('muted');
    hostVoiceIndicator.querySelector('.voice-icon').textContent = '🔇';
  }
}

function updatePlayerVoiceStatus(playerId, inVoice, isSpeaking = false) {
  const playerCard = document.getElementById(`player-${playerId}`);
  if (!playerCard) return;

  // Check if voice indicator already exists
  let voiceIndicator = playerCard.querySelector('.player-voice-indicator');

  if (inVoice) {
    // Add voice indicator if not present
    if (!voiceIndicator) {
      voiceIndicator = document.createElement('div');
      voiceIndicator.className = 'player-voice-indicator';
      playerCard.appendChild(voiceIndicator);
    }

    // Add speaking animation class to player card
    playerCard.classList.add('in-voice');

    // Add speaking animation if user is speaking
    if (isSpeaking) {
      playerCard.classList.add('speaking');
    } else {
      playerCard.classList.remove('speaking');
    }
  } else {
    // Remove voice indicator
    if (voiceIndicator) {
      voiceIndicator.remove();
    }

    // Remove speaking class
    playerCard.classList.remove('in-voice', 'speaking');
  }
}

function updateVoiceIndicators() {
  players.forEach(player => {
    if (player.inVoice) {
      updatePlayerVoiceStatus(player.id, true);
    }
  });
}

function startQuiz() {
  gameStarted = true;

  // Wenn Host: Sende Game-State an Bot API
  const isHost = localStorage.getItem('isHost') === 'true';
  if (isHost) {
    const lobbyCode = localStorage.getItem('lobbyCode');
    if (lobbyCode) {
      sendGameStateToBot(lobbyCode, true, 0);
    }
  }

  // Hide waiting message and host controls
  document.getElementById('question-area').style.display = 'none';
  document.getElementById('host-controls').style.display = 'none';

  // Show question content
  document.getElementById('question-content').style.display = 'block';

  // Load first question
  loadQuestion(0);

  // Start timer
  startTimer();

  // Start bot suggestions after 2 seconds
  setTimeout(() => {
    showBotSuggestions();
  }, 2000);
}

// Sende Game-State an Bot (nur Host)
async function sendGameStateToBot(lobbyCode, started, currentQuestion) {
  try {
    const apiUrl = CONFIG.getGameStateUrl(lobbyCode);
    console.log('🎮 Sende Game-State an Bot:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        started: started,
        currentQuestion: currentQuestion
      })
    });

    if (!response.ok) {
      console.error('❌ Fehler beim Senden des Game-State');
      return;
    }

    const result = await response.json();
    console.log('✅ Game-State erfolgreich gesendet:', result);

  } catch (error) {
    console.error('❌ Fehler beim Senden des Game-State:', error);
  }
}

function loadQuestion(questionIndex) {
  currentQuestion = questionIndex;
  const question = quizQuestions[questionIndex];

  // Update question number
  document.getElementById('question-number').textContent = `Frage ${questionIndex + 1} von ${quizQuestions.length}`;

  // Update question text
  document.getElementById('question-text').textContent = question.question;

  // Update answers
  const answerButtons = document.querySelectorAll('.answer-btn');
  answerButtons.forEach((btn, index) => {
    const answerText = btn.querySelector('.answer-text');
    answerText.textContent = question.answers[index];
    btn.dataset.answer = index;
    btn.classList.remove('selected', 'correct', 'wrong');
    btn.disabled = false;
  });

  selectedAnswer = null;
  botSuggestions = {};

  // Remove old bot suggestions
  document.querySelectorAll('.bot-suggestion').forEach(el => el.remove());

  // Reset timer
  const timerFill = document.getElementById('timer-fill');
  timerFill.style.width = '100%';
  timerFill.style.transition = 'none';
  setTimeout(() => {
    timerFill.style.transition = 'width 0.1s linear';
  }, 10);
}

function selectAnswer(button) {
  // Remove previous selection
  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.classList.remove('selected');
  });

  // Add selection to clicked button
  button.classList.add('selected');
  selectedAnswer = parseInt(button.dataset.answer);

  // Stop timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Auto-submit after 1 second
  setTimeout(() => {
    checkAnswer();
  }, 1000);
}

function checkAnswer() {
  const question = quizQuestions[currentQuestion];
  const answerButtons = document.querySelectorAll('.answer-btn');

  // Stop timer if still running
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Disable all buttons
  answerButtons.forEach(btn => {
    btn.disabled = true;
  });

  // Show correct/wrong
  answerButtons.forEach((btn, index) => {
    if (index === question.correctAnswer) {
      btn.classList.add('correct');
    } else if (index === selectedAnswer) {
      btn.classList.add('wrong');
    }
  });

  // Update score if correct
  if (selectedAnswer === question.correctAnswer) {
    updatePlayerScore(10);
  }

  // Update bot scores based on their suggestions
  updateBotScores();

  // Next question after 3 seconds
  setTimeout(() => {
    if (currentQuestion < quizQuestions.length - 1) {
      loadQuestion(currentQuestion + 1);
      startTimer();

      // Show bot suggestions after 2 seconds
      setTimeout(() => {
        showBotSuggestions();
      }, 2000);
    } else {
      showResults();
    }
  }, 3000);
}

function updatePlayerScore(points) {
  // Update first player score (simulating current user)
  if (players.length > 0) {
    players[0].score += points;

    const playerCard = document.getElementById(`player-${players[0].id}`);
    if (playerCard) {
      const scoreElement = playerCard.querySelector('.player-score');
      scoreElement.textContent = `${players[0].score} Punkte`;
    }
  }
}

function updateBotScores() {
  const question = quizQuestions[currentQuestion];

  // Update scores for all bots based on their suggestions
  players.forEach((player) => {
    if (botSuggestions[player.id] !== undefined) {
      if (botSuggestions[player.id] === question.correctAnswer) {
        player.score += 10;
        const playerCard = document.getElementById(`player-${player.id}`);
        if (playerCard) {
          const scoreElement = playerCard.querySelector('.player-score');
          scoreElement.textContent = `${player.score} Punkte`;
        }
      }
    }
  });
}

function showBotSuggestions() {
  // All players (bots) suggest answers
  players.forEach((player) => {
    const question = quizQuestions[currentQuestion];
    let suggestedAnswer;

    // 60% chance to suggest correct answer, 40% random
    if (Math.random() < 0.6) {
      suggestedAnswer = question.correctAnswer;
    } else {
      suggestedAnswer = Math.floor(Math.random() * 4);
    }

    botSuggestions[player.id] = suggestedAnswer;

    // Show suggestion bubble
    const playerCard = document.getElementById(`player-${player.id}`);
    if (playerCard) {
      const suggestion = document.createElement('div');
      suggestion.className = 'bot-suggestion';
      suggestion.textContent = String.fromCharCode(65 + suggestedAnswer); // A, B, C, D
      playerCard.appendChild(suggestion);
    }
  });
}

function startTimer() {
  const timerFill = document.getElementById('timer-fill');
  let timeLeft = 100;

  // Clear any existing timer
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {
    timeLeft -= 0.5;
    timerFill.style.width = timeLeft + '%';

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (selectedAnswer === null) {
        // Time's up, no answer selected
        checkAnswer();
      }
    }
  }, 100);
}

function showResults() {
  const questionContent = document.getElementById('question-content');

  // Sort players by score
  players.sort((a, b) => b.score - a.score);

  let resultsHTML = `
    <div class="question-number">Quiz Beendet!</div>
    <h2 class="question-text">Ergebnisse</h2>
    <div style="text-align: center; color: #e9d5ff;">
  `;

  players.forEach((player, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📊';
    resultsHTML += `
      <div style="font-size: 1.3rem; margin: 20px 0;">
        ${medal} ${index + 1}. ${player.name} - ${player.score} Punkte
      </div>
    `;
  });

  resultsHTML += `</div>`;

  questionContent.innerHTML = resultsHTML;
}

// Keyboard shortcuts for testing
document.addEventListener('keydown', function(e) {
  // Press 's' to start quiz (host only)
  if (e.key === 's' && !gameStarted) {
    const startBtn = document.getElementById('start-quiz-btn');
    if (startBtn && startBtn.style.display !== 'none') {
      startQuiz();
    }
  }

  // Press 1-4 to select answers
  if (gameStarted && e.key >= '1' && e.key <= '4') {
    const answerIndex = parseInt(e.key) - 1;
    const answerBtn = document.querySelector(`.answer-btn[data-answer="${answerIndex}"]`);
    if (answerBtn && !answerBtn.disabled) {
      selectAnswer(answerBtn);
    }
  }

  // Press 'f' for fullscreen toggle
  if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  }

  // Press 'j' to simulate player joining voice
  if (e.key === 'j' || e.key === 'J') {
    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    if (randomPlayer && !randomPlayer.inVoice) {
      simulatePlayerJoinVoice(randomPlayer.id);
    }
  }

  // Press 'l' to simulate player leaving voice
  if (e.key === 'l' || e.key === 'L') {
    const voicePlayer = players.find(p => p.inVoice);
    if (voicePlayer) {
      simulatePlayerLeaveVoice(voicePlayer.id);
    }
  }
});

// Load players from voice channel (if host)
async function loadPlayersFromVoiceChannel() {
  console.log('🎮 Lade alle Spieler aus dem Voice-Channel...');

  try {
    const apiUrl = CONFIG.getGamenightUsersUrl();
    console.log('🔄 Fetching gamenight users from:', apiUrl);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('❌ Bot API nicht erreichbar - Status:', response.status);
      return;
    }

    const voiceUsers = await response.json();
    console.log('✅ Voice-Channel User geladen:', voiceUsers);

    // Get current user (host) ID
    const storedUser = localStorage.getItem('discordUser');
    const currentUser = storedUser ? JSON.parse(storedUser) : null;
    const currentUserId = currentUser ? currentUser.id : null;

    // Add each voice user as player (except host)
    voiceUsers.forEach(voiceUser => {
      // Skip host
      if (currentUserId && voiceUser.id === currentUserId) {
        console.log('⏭️ Host übersprungen:', voiceUser.username);
        return;
      }

      // Check if player already exists
      const existingPlayer = players.find(p => p.id === voiceUser.id);
      if (existingPlayer) {
        console.log('⏭️ Spieler bereits in Liste:', voiceUser.username);
        return;
      }

      // Create avatar URL
      const avatarUrl = voiceUser.avatar
        ? `https://cdn.discordapp.com/avatars/${voiceUser.id}/${voiceUser.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(voiceUser.discriminator || '0') % 5}.png`;

      // Create player object
      const newPlayer = {
        id: voiceUser.id,
        name: voiceUser.global_name || voiceUser.username,
        avatar: avatarUrl,
        score: 0,
        inVoice: true
      };

      addPlayer(newPlayer);
      console.log('✅ Spieler hinzugefügt:', newPlayer.name);
    });

    // Show success message
    if (voiceUsers.length > 0) {
      console.log(`🎉 ${voiceUsers.length} Spieler aus dem Voice-Channel geladen!`);
    } else {
      console.log('ℹ️ Keine Spieler im Voice-Channel gefunden');
    }

  } catch (error) {
    console.error('❌ Fehler beim Laden der Voice-Channel User:', error);
  }
}

// Add current user as player (if not host)
function addCurrentUserAsPlayer() {
  const storedUser = localStorage.getItem('discordUser');
  const isHost = localStorage.getItem('isHost') === 'true';

  console.log('👤 addCurrentUserAsPlayer - isHost:', isHost);

  if (!storedUser) {
    console.log('❌ Kein User gefunden');
    return;
  }

  if (isHost) {
    console.log('✅ User ist Host - wird NICHT als Spieler hinzugefügt');
    return;
  }

  const user = JSON.parse(storedUser);

  // Check if user is already in players list
  const existingPlayer = players.find(p => p.id === user.id);
  if (existingPlayer) {
    console.log('⏭️ User ist bereits in der Spielerliste');
    return;
  }

  // Add user as player
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`;

  const newPlayer = {
    id: user.id,
    name: user.global_name || user.username,
    avatar: avatarUrl,
    score: 0,
    inVoice: false
  };

  addPlayer(newPlayer);
  console.log('✅ User als Spieler hinzugefügt:', newPlayer.name);
}
