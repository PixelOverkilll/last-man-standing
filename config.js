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
      production: 'https://pixeloverk.github.io/last-man-standing/' // ✅ Angepasst!
    },

    SCOPES: 'identify+guilds.members.read'
  },

  // Bot API Configuration
  BOT_API: {
    BASE_URL: {
      development: 'http://localhost:3000',
      production: 'https://last-man-standing-bot.onrender.com' // Wird später angepasst
    },

    ENDPOINTS: {
      voiceStates: '/api/voice-states'
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
  }
};

// Log current environment
console.log(`🚀 Running in ${CONFIG.ENV} mode`);
console.log(`📍 Redirect URI: ${CONFIG.getRedirectUri()}`);
console.log(`🤖 Bot API: ${CONFIG.getBotApiUrl()}`);
# 🚀 Deployment Guide - Last Man Standing

## Schritt 1: GitHub Repository erstellen

### 1.1 Erstelle ein GitHub Repository
1. Gehe zu https://github.com/new
2. Repository Name: `last-man-standing`
3. Beschreibung: "Last Man Standing - Quiz Game"
4. **Public** Repository (wichtig für GitHub Pages!)
5. Klicke "Create repository"

### 1.2 Code zu GitHub hochladen

Öffne Git Bash oder CMD im Projektordner und führe aus:

```bash
cd "C:\Users\Crave\IdeaProjects\Last man standing"
git init
git add .
git commit -m "Initial commit - Last Man Standing"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/last-man-standing.git
git push -u origin main
```

## Schritt 2: GitHub Pages aktivieren

1. Gehe zu deinem Repository auf GitHub
2. Klicke auf **Settings** (oben rechts)
3. Scrolle zu **Pages** (linke Sidebar)
4. Bei **Source** wähle: `main` Branch
5. Klicke **Save**
6. Warte 2-3 Minuten

**Deine Webseite ist jetzt erreichbar unter:**
`https://DEIN-USERNAME.github.io/last-man-standing/`

---

## Schritt 3: Discord OAuth URL anpassen

### 3.1 Discord Developer Portal aktualisieren

1. Gehe zu: https://discord.com/developers/applications
2. Wähle deine Application
3. Gehe zu **OAuth2** → **General**
4. Füge hinzu unter **Redirects**:
   ```
   https://DEIN-USERNAME.github.io/last-man-standing/
   ```
5. Klicke **Save Changes**

### 3.2 Code anpassen

Die Datei `js/app.js` muss angepasst werden - ich mache das automatisch für dich!

---

## Schritt 4: Discord Bot auf Server hosten (WICHTIG!)

**Problem:** Dein Discord Bot läuft aktuell nur auf `localhost:3000`.
**Lösung:** Hoste den Bot auf einem Server, damit er 24/7 läuft.

### Option A: Kostenlos mit Render.com (Empfohlen)

1. Gehe zu: https://render.com/
2. Klicke **Sign Up** → Mit GitHub verbinden
3. Klicke **New** → **Web Service**
4. Verbinde dein Repository oder erstelle ein neues für den Bot
5. Settings:
   - **Name:** `last-man-standing-bot`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node discord-bot.js`
   - **Plan:** Free
6. Klicke **Create Web Service**

**Dein Bot API wird erreichbar sein unter:**
`https://last-man-standing-bot.onrender.com/api/voice-states`

### Option B: Mit Railway.app (auch kostenlos)

1. Gehe zu: https://railway.app/
2. Melde dich an mit GitHub
3. Klicke **New Project** → **Deploy from GitHub repo**
4. Wähle dein Bot Repository
5. Railway erkennt automatisch Node.js
6. Füge Environment Variables hinzu (Discord Token, etc.)

---

## Schritt 5: Bot API URL im Code aktualisieren

Die `lobby.js` muss die neue Bot URL verwenden.
Ich passe das automatisch für dich an!

---

## Alternative: Eigener Server/VPS

Wenn du einen eigenen Server hast (z.B. bei Hetzner, Contabo, DigitalOcean):

1. **Webseite:** Lade die Dateien per FTP/SFTP hoch
2. **Bot:** Installiere Node.js und lasse den Bot mit PM2 laufen:
   ```bash
   npm install -g pm2
   pm2 start discord-bot.js --name "lms-bot"
   pm2 save
   pm2 startup
   ```

---

## 🎯 Zusammenfassung der URLs

Nach dem Setup hast du:

- **Webseite:** `https://DEIN-USERNAME.github.io/last-man-standing/`
- **Bot API:** `https://last-man-standing-bot.onrender.com/api/voice-states`
- **Discord OAuth Redirect:** `https://DEIN-USERNAME.github.io/last-man-standing/`

---

## 📝 Wichtige Dateien die angepasst werden müssen:

1. ✅ `js/app.js` - Discord Redirect URI
2. ✅ `js/lobby.js` - Bot API URL
3. ✅ Discord Developer Portal - OAuth Redirect

Ich passe diese Dateien jetzt automatisch an!

---

## 🔒 Sicherheit

- **GitHub:** Committe NIEMALS deinen Discord Bot Token!
- **Environment Variables:** Nutze `.env` Dateien (nicht in Git!)
- **Bot Hosting:** Setze Environment Variables auf Render/Railway

---

## 🆘 Probleme?

### CORS Fehler?
Stelle sicher, dass dein Bot CORS aktiviert hat:
```javascript
app.use(cors({
  origin: 'https://DEIN-USERNAME.github.io'
}));
```

### Discord OAuth funktioniert nicht?
- Prüfe die Redirect URI im Discord Developer Portal
- Prüfe die URL in `js/app.js`
- Beide müssen EXAKT übereinstimmen!

### Bot antwortet nicht?
- Prüfe ob der Bot online ist (Render Dashboard)
- Prüfe die Bot API URL in `lobby.js`
- Prüfe die Browser Console für Fehler
