// Discord OAuth2 Configuration
// Nutzt jetzt die config.js für automatisches Umschalten zwischen Local/Production
const DISCORD_OAUTH_URL = CONFIG.getDiscordOAuthUrl();

// Quiz Start Page JavaScript with Discord Integration
document.addEventListener('DOMContentLoaded', function() {

  // JS-Fallback zur Positionierung entfernt — CSS regelt jetzt die fixe Position des bg-selector

  // Elements
  const loginSection = document.getElementById('login-section');
  const userSection = document.getElementById('user-section');
  const discordLoginBtn = document.getElementById('discord-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const createLobbyBtn = document.getElementById('create-lobby-btn');
  const joinLobbyBtn = document.getElementById('join-lobby-btn');
  const lobbyCodeInput = document.getElementById('lobby-code');

  // Background Selector
  const bgButtons = document.querySelectorAll('.bg-btn');
  const savedBg = localStorage.getItem('backgroundStyle') || 'checkerboard';

  // Set initial background
  setBackground(savedBg);

  // Background button click handlers
  bgButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const bgType = this.getAttribute('data-bg');
      setBackground(bgType);
      localStorage.setItem('backgroundStyle', bgType);
    });
  });

  function setBackground(bgType) {
    // Remove all background classes
    document.body.classList.remove('bg-checkerboard', 'bg-gradient', 'bg-dots', 'bg-waves');

    // Remove active state from all buttons
    bgButtons.forEach(btn => btn.classList.remove('active'));

    // Add selected background class (default is checkerboard, no class needed)
    if (bgType !== 'checkerboard') {
      document.body.classList.add(`bg-${bgType}`);
    }

    // Set active button
    const activeBtn = document.querySelector(`[data-bg="${bgType}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }

  // Check for access token in URL (after Discord redirect)
  function getAccessTokenFromURL() {
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);
    return params.get('access_token');
  }

  // Fetch Discord user info
  async function fetchDiscordUser(accessToken) {
    try {
      const response = await fetch('https://discord.com/api/users/@me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error fetching Discord user:', error);
    }
    return null;
  }

  // Fetch Discord voice state
  async function fetchDiscordVoiceState(accessToken) {
    try {
      // Try to get voice state from Discord RPC
      const response = await fetch('https://discord.com/api/users/@me/connections', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const connections = await response.json();
        console.log('Discord connections:', connections);
        // Store voice state info
        localStorage.setItem('discordVoiceState', JSON.stringify(connections));
      }
    } catch (error) {
      console.error('Error fetching Discord voice state:', error);
    }
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

      // Convert to HSL for better color manipulation
      const hsl = rgbToHsl(r, g, b);

      // VERBESSERT: Verschiebe Farbe in Richtung Lila/Violett (Hue ~270-300°)
      // Wenn die Farbe zu weit von Lila entfernt ist, ziehe sie näher heran
      let targetHue = hsl[0];
      const purpleHue = 0.75; // 270° in 0-1 Skala (Lila/Violett)

      // Berechne den Abstand zum Lila-Ton
      let hueDiff = Math.abs(targetHue - purpleHue);
      if (hueDiff > 0.5) hueDiff = 1 - hueDiff; // Berücksichtige Hue-Wrap

      // Wenn die Farbe zu weit von Lila entfernt ist, verschiebe sie sanft
      if (hueDiff > 0.15) {
        // Mische die extrahierte Farbe mit Lila (70% Lila, 30% Original)
        targetHue = purpleHue * 0.7 + targetHue * 0.3;
      }

      // Erhöhe Sättigung für lebendigere Farben
      hsl[1] = Math.min(hsl[1] * 1.8, 0.9); // Höhere Sättigung

      // Optimale Helligkeit für gute Sichtbarkeit
      hsl[2] = Math.max(0.45, Math.min(hsl[2], 0.65));

      const rgb = hslToRgb(targetHue, hsl[1], hsl[2]);
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

  // Apply user theme color
  function applyUserThemeColor(color) {
    const userCard = document.querySelector('.user-info-card');
    const userAvatar = document.querySelector('.user-avatar');
    const startContent = document.querySelector('.start-content');
    const optionCards = document.querySelectorAll('.option-card');
    const discordCard = document.querySelector('.discord-login-card');

    // Parse RGB values
    const rgb = color.match(/\d+/g).map(Number);

    // Apply to user card and avatar
    if (userCard) {
      userCard.style.borderColor = color;
      userCard.style.boxShadow = `0 10px 30px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.4)`;
    }

    if (userAvatar) {
      userAvatar.style.borderColor = color;
      userAvatar.style.boxShadow = `0 4px 15px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.6)`;
    }

    // Apply to main container
    if (startContent) {
      startContent.style.borderColor = color;
      startContent.style.boxShadow = `0 20px 60px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.4)`;
    }

    // Apply to option cards
    optionCards.forEach(card => {
      card.style.borderColor = color;
      card.style.boxShadow = `0 5px 20px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2)`;
    });

    // Apply to discord card if visible
    if (discordCard) {
      discordCard.style.borderColor = color;
    }

    // Also set CSS variable for compatibility
    document.documentElement.style.setProperty('--user-theme-color', color);
    document.documentElement.style.setProperty('--user-theme-rgb', `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`);
  }

  // Display user info
  function displayUserInfo(user, accessToken) {
    // Store user data
    localStorage.setItem('discordUser', JSON.stringify(user));
    localStorage.setItem('discordToken', accessToken);

    // Update UI
    document.getElementById('user-name').textContent = user.global_name || user.username;
    document.getElementById('user-discriminator').textContent = user.discriminator !== '0' ? `#${user.discriminator}` : '';

    // Set avatar
    const avatarImg = document.getElementById('avatar-img');
    if (user.avatar) {
      const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
      avatarImg.src = avatarUrl;

      // Extract and apply dominant color from avatar
      extractDominantColor(avatarUrl, (color) => {
        applyUserThemeColor(color);
      });
    } else {
      // Default Discord avatar
      const defaultAvatarNum = parseInt(user.discriminator) % 5;
      avatarImg.src = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNum}.png`;
      // Use default purple color
      applyUserThemeColor('#7c3aed');
    }

    // Show user section, hide login section
    loginSection.style.display = 'none';
    userSection.style.display = 'block';

    // Clear URL hash
    window.history.replaceState(null, null, window.location.pathname);

    // Try to fetch voice state
    fetchDiscordVoiceState(accessToken);
  }

  // Check if user is already logged in
  function checkExistingLogin() {
    const storedUser = localStorage.getItem('discordUser');
    const storedToken = localStorage.getItem('discordToken');

    if (storedUser && storedToken) {
      const user = JSON.parse(storedUser);
      displayUserInfo(user, storedToken);
      return true;
    }
    return false;
  }

  // Initialize
  async function init() {
    // Check for access token in URL
    const accessToken = getAccessTokenFromURL();

    if (accessToken) {
      // Fetch user info from Discord
      const user = await fetchDiscordUser(accessToken);
      if (user) {
        displayUserInfo(user, accessToken);
        return;
      }
    }

    // Check for existing login
    if (checkExistingLogin()) {
      return;
    }

    // Show login section
    loginSection.style.display = 'block';
    userSection.style.display = 'none';
  }

  // Discord Login Button
  discordLoginBtn.addEventListener('click', function() {
    window.location.href = DISCORD_OAUTH_URL;
  });

  // Logout Button
  logoutBtn.addEventListener('click', function() {
    localStorage.removeItem('discordUser');
    localStorage.removeItem('discordToken');
    localStorage.removeItem('lobbyCode');
    localStorage.removeItem('isHost');
    localStorage.removeItem('discordVoiceState');

    loginSection.style.display = 'block';
    userSection.style.display = 'none';
  });

  // Check if lobby code is valid
  function isLobbyCodeValid() {
    return lobbyCodeInput.value.trim().length >= 4;
  }

  // Update join button state
  function updateJoinButtonState() {
    joinLobbyBtn.disabled = !isLobbyCodeValid();
  }

  // Listen to lobby code input
  lobbyCodeInput.addEventListener('input', function() {
    this.value = this.value.toUpperCase();
    updateJoinButtonState();
  });

  // Create Lobby Button
  // Create Lobby Button
  // Create Lobby Button
  createLobbyBtn.addEventListener('click', async function() {
    // WICHTIG: Prüfe ob User eingeloggt ist
    const storedUser = localStorage.getItem('discordUser');

    if (!storedUser) {
      console.error('❌ Kein Discord User gefunden! Bitte melde dich zuerst an.');
      alert('Bitte melde dich zuerst mit Discord an!');
      return;
    }

    // Admin-Passwort abfragen
    const adminPassword = prompt('🔐 Admin-Passwort eingeben um Lobby zu erstellen:');
    if (adminPassword !== 'PXL339') {
      alert('❌ Falsches Passwort! Lobby kann nicht erstellt werden.');
      console.error('❌ Falsches Admin-Passwort');
      return;
    }

    const userData = JSON.parse(storedUser);
    const localLobbyCode = generateLobbyCode();

    // Zeige Code sofort im Eingabefeld
    lobbyCodeInput.value = localLobbyCode;
    updateJoinButtonState();

    const socket = window.__LMS_SOCKET;
    if (socket && socket.connected) {
      try {
        // send `player` with `name` property which the server expects
        socket.emit('create-lobby', { lobbyId: localLobbyCode, player: { id: userData.id, name: (userData.global_name || userData.username) } }, (res) => {
          console.log('[app] create-lobby ack', res);
          if (res && (res.ok === true || res.lobbyId)) {
            const finalCode = res.lobbyId || localLobbyCode;
            try { localStorage.setItem('lobbyCode', finalCode); localStorage.setItem('isHost', 'true'); } catch(e){}
            setTimeout(function(){ window.location.href = 'lobby.html?code=' + encodeURIComponent(finalCode); }, 150);
          } else {
            alert('Erstellen der Lobby fehlgeschlagen: ' + (res && res.error ? res.error : 'Unbekannter Fehler'));
            console.error('[app] create-lobby failed', res);
          }
        });
      } catch (err) {
        console.error('[app] Fehler beim Senden von create-lobby über Socket:', err);
        try { localStorage.setItem('lobbyCode', localLobbyCode); localStorage.setItem('isHost', 'true'); } catch(e){}
        setTimeout(function(){ window.location.href = 'lobby.html?code=' + encodeURIComponent(localLobbyCode); }, 150);
      }
    } else {
      console.warn('[app] kein Socket verfügbar, verwende Fallback für Lobby-Erstellung');
      try { localStorage.setItem('lobbyCode', localLobbyCode); localStorage.setItem('isHost', 'true'); } catch(e){}
      setTimeout(function(){ window.location.href = 'lobby.html?code=' + encodeURIComponent(localLobbyCode); }, 150);
    }
  });

  // Join Lobby Button
  joinLobbyBtn.addEventListener('click', function() {
    if (!isLobbyCodeValid()) return;

    const storedUser = localStorage.getItem('discordUser');
    if (!storedUser) {
      console.error('❌ Kein Discord User gefunden! Bitte melde dich zuerst an.');
      alert('Bitte melde dich zuerst mit Discord an!');
      return;
    }

    const userData = JSON.parse(storedUser);
    const code = lobbyCodeInput.value.trim();

    const socket = window.__LMS_SOCKET;
    if (socket && socket.connected) {
      try {
        // ensure we send player.name to match server expectations
        socket.emit('join-lobby', { lobbyId: code, player: { id: userData.id, name: (userData.global_name || userData.username) } }, (res) => {
          console.log('[app] join-lobby ack', res);
          if (res && res.ok) {
            try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'false'); } catch(e){}
            setTimeout(function(){ window.location.href = 'lobby.html?code=' + encodeURIComponent(code); }, 150);
          } else {
            alert('Beitreten der Lobby fehlgeschlagen: ' + (res && res.error ? res.error : 'Lobby nicht gefunden oder geschlossen'));
            console.error('[app] join-lobby failed', res);
          }
        });
      } catch (err) {
        console.error('[app] Fehler beim Senden von join-lobby über Socket:', err);
        try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'false'); } catch(e){}
        setTimeout(function(){ window.location.href = 'lobby.html?code=' + encodeURIComponent(code); }, 150);
      }
    } else {
      console.warn('[app] kein Socket verfügbar, verwende Fallback für Lobby-Beitritt');
      try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'false'); } catch(e){}
      setTimeout(function(){ window.location.href = 'lobby.html?code=' + encodeURIComponent(code); }, 150);
    }
  });
// Generate random lobby code
  function generateLobbyCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Design-Menü anzeigen/ausblenden
  const bgMenuBtn = document.getElementById('bg-menu-btn');
  const bgOptions = document.getElementById('bg-options');

  bgMenuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (bgOptions.style.display === 'none' || bgOptions.style.display === '') {
      bgOptions.style.display = 'block';
    } else {
      bgOptions.style.display = 'none';
    }
  });

  // Schließt das Menü, wenn außerhalb geklickt wird
  document.addEventListener('click', function(e) {
    if (!bgOptions.contains(e.target) && !bgMenuBtn.contains(e.target)) {
      bgOptions.style.display = 'none';
    }
  });

  // Initialize the app
  init();
});
