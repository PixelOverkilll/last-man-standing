// Quiz Lobby JavaScript with Test Data

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

// Test Players (no host as player)
const testPlayers = [
  {
    id: "player1",
    name: "MaxMustermann",
    avatar: "https://i.pravatar.cc/150?img=12",
    score: 0,
    inVoice: true
  },
  {
    id: "player2",
    name: "LauraSchmidt",
    avatar: "https://i.pravatar.cc/150?img=25",
    score: 0,
    inVoice: false
  },
  {
    id: "player3",
    name: "TimKaiser",
    avatar: "https://i.pravatar.cc/150?img=33",
    score: 0,
    inVoice: true
  }
];

// Game State
let currentQuestion = 0;
let selectedAnswer = null;
let gameStarted = false;
let timerInterval = null;
let botSuggestions = {};
let voiceUsers = []; // Track users in voice channel

document.addEventListener('DOMContentLoaded', function() {

  // Load host info
  loadHostInfo();

  // Load players
  loadPlayers();

  // Check if user is host
  checkIfHost();

  // Setup event listeners
  setupEventListeners();

  // Setup fullscreen button
  setupFullscreen();

  // Check for Discord voice state (simulate for now)
  checkDiscordVoiceState();
});

function loadHostInfo() {
  const storedUser = localStorage.getItem('discordUser');
  const lobbyCode = localStorage.getItem('lobbyCode') || 'ABC123';

  if (storedUser) {
    const user = JSON.parse(storedUser);
    const hostAvatar = document.getElementById('host-avatar');
    const hostName = document.getElementById('host-name');

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
    // Use test host - use a placeholder with specific color for testing
    const testAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=TestHost&backgroundColor=b6e3f4';
    document.getElementById('host-avatar').src = testAvatar;
    document.getElementById('host-name').textContent = 'TestHost';

    // For test mode, apply default purple color
    console.log('Test-Modus: Verwende Standard-Lila-Farbe');
    applyHostThemeColor('rgb(124, 58, 237)'); // Default purple
  }

  // Set lobby code
  document.getElementById('lobby-code-display').textContent = lobbyCode;
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

  testPlayers.forEach(player => {
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
  testPlayers.push(player);
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
  // Prüfe Voice-States alle 2 Sekunden
  setInterval(async () => {
    try {
      // Nutze die konfigurierte Bot API URL (funktioniert lokal UND online)
      const response = await fetch(CONFIG.getVoiceStatesUrl());

      if (!response.ok) {
        console.error('Bot API nicht erreichbar');
        return;
      }

      const voiceStates = await response.json();

      // Update voice states für alle User
      updateAllVoiceStates(voiceStates, currentUserId);

    } catch (error) {
      console.error('Fehler beim Abrufen der Voice-States:', error);
    }
  }, 2000); // Alle 2 Sekunden aktualisieren
}

function updateAllVoiceStates(voiceStates, currentUserId) {
  console.log('🔍 Voice States vom Bot:', voiceStates);
  console.log('🔍 Meine User ID:', currentUserId);

  // Update Debug Info
  document.getElementById('debug-user-id').textContent = currentUserId || 'Nicht geladen';
  document.getElementById('debug-bot-status').textContent = '✅ Verbunden';
  document.getElementById('debug-bot-status').style.color = '#10b981';

  // Update Host wenn er spricht
  const hostState = voiceStates.find(state => state.userId === currentUserId);
  console.log('🔍 Host State gefunden:', hostState);

  if (hostState) {
    console.log('✅ Host im Voice:', hostState);

    // Update Debug Info
    document.getElementById('debug-in-voice').textContent = '✅ Ja';
    document.getElementById('debug-in-voice').style.color = '#10b981';
    document.getElementById('debug-muted').textContent = hostState.muted ? '🔇 Ja' : '🎤 Nein';
    document.getElementById('debug-muted').style.color = hostState.muted ? '#ef4444' : '#10b981';
    document.getElementById('debug-speaking').textContent = hostState.speaking ? '🟢 Ja' : '⚪ Nein';
    document.getElementById('debug-speaking').style.color = hostState.speaking ? '#10b981' : '#ef4444';

    updateHostVoiceStatus(hostState.speaking);
  } else {
    console.log('❌ Host nicht im Voice gefunden');

    // Update Debug Info
    document.getElementById('debug-in-voice').textContent = '❌ Nein';
    document.getElementById('debug-in-voice').style.color = '#ef4444';
    document.getElementById('debug-muted').textContent = '-';
    document.getElementById('debug-muted').style.color = '#6b7280';
    document.getElementById('debug-speaking').textContent = '❌ Nein';
    document.getElementById('debug-speaking').style.color = '#ef4444';

    updateHostVoiceStatus(false);
  }

  // Update alle Spieler
  testPlayers.forEach(player => {
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
  testPlayers.forEach(player => {
    if (player.inVoice) {
      updatePlayerVoiceStatus(player.id, true);
    }
  });
}

function startQuiz() {
  gameStarted = true;

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
  if (testPlayers.length > 0) {
    testPlayers[0].score += points;

    const playerCard = document.getElementById(`player-${testPlayers[0].id}`);
    if (playerCard) {
      const scoreElement = playerCard.querySelector('.player-score');
      scoreElement.textContent = `${testPlayers[0].score} Punkte`;
    }
  }
}

function updateBotScores() {
  const question = quizQuestions[currentQuestion];

  // Update scores for all bots based on their suggestions
  testPlayers.forEach((player) => {
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
  testPlayers.forEach((player) => {
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
  testPlayers.sort((a, b) => b.score - a.score);

  let resultsHTML = `
    <div class="question-number">Quiz Beendet!</div>
    <h2 class="question-text">Ergebnisse</h2>
    <div style="text-align: center; color: #e9d5ff;">
  `;

  testPlayers.forEach((player, index) => {
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
    const randomPlayer = testPlayers[Math.floor(Math.random() * testPlayers.length)];
    if (randomPlayer && !randomPlayer.inVoice) {
      simulatePlayerJoinVoice(randomPlayer.id);
    }
  }

  // Press 'l' to simulate player leaving voice
  if (e.key === 'l' || e.key === 'L') {
    const voicePlayer = testPlayers.find(p => p.inVoice);
    if (voicePlayer) {
      simulatePlayerLeaveVoice(voicePlayer.id);
    }
  }
});
