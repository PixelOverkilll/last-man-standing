// Discord OAuth2 Configuration
// Nutzt jetzt die config.js für automatisches Umschalten zwischen Local/Production
const DISCORD_CLIENT_ID = CONFIG.DISCORD.CLIENT_ID;
const DISCORD_REDIRECT_URI = CONFIG.getRedirectUri();
const DISCORD_OAUTH_URL = CONFIG.getDiscordOAuthUrl();

// Quiz Start Page JavaScript with Discord Integration
document.addEventListener('DOMContentLoaded', function() {

  // Elements
  const loginSection = document.getElementById('login-section');
  const userSection = document.getElementById('user-section');
  const discordLoginBtn = document.getElementById('discord-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const createLobbyBtn = document.getElementById('create-lobby-btn');
  const joinLobbyBtn = document.getElementById('join-lobby-btn');
  const lobbyCodeInput = document.getElementById('lobby-code');

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
        const user = await response.json();
        return user;
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
  createLobbyBtn.addEventListener('click', function() {
    const userData = JSON.parse(localStorage.getItem('discordUser'));
    const lobbyCode = generateLobbyCode();

    localStorage.setItem('lobbyCode', lobbyCode);
    localStorage.setItem('isHost', 'true');

    // Redirect to lobby with code in URL
    window.location.href = `lobby.html?code=${lobbyCode}`;
  });

  // Join Lobby Button
  joinLobbyBtn.addEventListener('click', function() {
    if (isLobbyCodeValid()) {
      const userData = JSON.parse(localStorage.getItem('discordUser'));
      const lobbyCode = lobbyCodeInput.value.trim();

      localStorage.setItem('lobbyCode', lobbyCode);
      localStorage.setItem('isHost', 'false');

      // Redirect to lobby with code in URL
      window.location.href = `lobby.html?code=${lobbyCode}`;
    } else {
      alert('Bitte gib einen gültigen Lobby-Code ein');
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

  // Initialize the app
  init();
});
