// Configuration for deployment
// Diese Datei ermöglicht einfaches Umschalten zwischen Local und Production

const CONFIG = {
  // Environment: 'development' oder 'production'
  ENV: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'development'
    : 'production',

  // Discord OAuth Configuration
  DISCORD: {
    CLIENT_ID: '1427768040140836916', // Deine Discord Application ID

    // Redirect URIs für verschiedene Umgebungen
    REDIRECT_URI: {
      development: 'http://localhost/quiz-lobby/',
      production: 'https://pixeloverkilll.github.io/last-man-standing/index.html'
    },

    SCOPES: 'identify+guilds.members.read'
  },

  // Bot API Configuration
  BOT_API: {
    BASE_URL: {
      development: 'http://localhost:3000',
      production: 'https://last-man-standing-n81r.onrender.com'
    },

    ENDPOINTS: {
      voiceStates: '/api/voice-states',
      gamenightUsers: '/api/gamenight-users'
    }
  },

  // Get current redirect URI based on environment
  getRedirectUri() {
    return this.DISCORD.REDIRECT_URI[this.ENV];
  },

  // Get current bot API URL based on environment
  getBotApiUrl() {
    return this.BOT_API.BASE_URL[this.ENV];
  },

  // Get Discord OAuth URL
  getDiscordOAuthUrl() {
    const redirectUri = this.getRedirectUri();
    return `https://discord.com/api/oauth2/authorize?client_id=${this.DISCORD.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${this.DISCORD.SCOPES}`;
  },

  // Get Voice States API URL
  getVoiceStatesUrl() {
    return `${this.getBotApiUrl()}${this.BOT_API.ENDPOINTS.voiceStates}`;
  },

  // Get Gamenight Users API URL
  getGamenightUsersUrl() {
    return `${this.getBotApiUrl()}${this.BOT_API.ENDPOINTS.gamenightUsers}`;
  }
};

// Log current environment
console.log(`🚀 Running in ${CONFIG.ENV} mode`);
console.log(`📍 Redirect URI: ${CONFIG.getRedirectUri()}`);
console.log(`🤖 Bot API: ${CONFIG.getBotApiUrl()}`);
