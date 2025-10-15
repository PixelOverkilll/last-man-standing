# 🚀 Quick Start - Online Deployment

## Was ich gerade gemacht habe:

✅ **config.js erstellt** - Automatisches Umschalten zwischen Lokal/Online
✅ **.gitignore erstellt** - Schützt sensible Daten
✅ **Code angepasst** - Nutzt jetzt die config.js
✅ **DEPLOYMENT_GUIDE.md** - Vollständige Anleitung

---

## 📋 So machst du es online (3 einfache Schritte):

### Schritt 1: GitHub Repository
```bash
# Öffne Git Bash im Projektordner
cd "C:\Users\Crave\IdeaProjects\Last man standing"

# Initialisiere Git
git init
git add .
git commit -m "Initial commit - Last Man Standing Quiz"

# Verbinde mit GitHub (ersetze DEIN-USERNAME mit deinem GitHub Namen)
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/last-man-standing.git
git push -u origin main
```

### Schritt 2: GitHub Pages aktivieren
1. Gehe zu deinem Repository auf GitHub.com
2. Klicke **Settings** → **Pages**
3. Source: `main` Branch auswählen
4. **Save** klicken
5. Nach 2-3 Minuten ist deine Seite online!

**Deine URL:** `https://DEIN-USERNAME.github.io/last-man-standing/`

### Schritt 3: Config anpassen

**Öffne `config.js` und ändere diese 2 Zeilen:**

```javascript
// Zeile 10 - Ersetze mit deinem GitHub Username
production: 'https://DEIN-USERNAME.github.io/last-man-standing/'

// Zeile 18 - Ersetze mit deiner Bot URL (später)
production: 'https://DEIN-BOT-URL.onrender.com'
```

**Dann:**
```bash
git add config.js
git commit -m "Update production URLs"
git push
```

---

## 🤖 Discord Bot Online hosten

### Option A: Render.com (Kostenlos & Empfohlen)

1. **Bot Code vorbereiten:**
   ```bash
   cd bot
   # Erstelle package.json falls nicht vorhanden
   npm init -y
   ```

2. **Auf Render.com:**
   - Gehe zu https://render.com
   - Sign Up mit GitHub
   - **New** → **Web Service**
   - Verbinde dein Repository
   - Settings:
     - **Environment:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `node discord-bot.js`
   - Füge Environment Variables hinzu:
     - `DISCORD_TOKEN` = dein Discord Bot Token
   - **Create Web Service**

3. **Bot URL kopieren:**
   - Z.B.: `https://last-man-standing-bot.onrender.com`
   - Trage diese URL in `config.js` ein (Zeile 18)

---

## 🔐 Discord OAuth aktualisieren

Nachdem deine Seite online ist:

1. Gehe zu: https://discord.com/developers/applications
2. Wähle deine Application
3. **OAuth2** → **General**
4. Füge hinzu unter **Redirects:**
   ```
   https://DEIN-USERNAME.github.io/last-man-standing/
   ```
5. **Save Changes**

---

## ✅ Fertig! Jetzt kannst du den Link teilen:

**Deine Webseite:**
```
https://DEIN-USERNAME.github.io/last-man-standing/
```

**Teile diesen Link mit deinen Freunden! 🎉**

---

## 🔄 Updates deployen

Wenn du Änderungen machst:
```bash
git add .
git commit -m "Beschreibung der Änderung"
git push
```

GitHub Pages aktualisiert automatisch in 1-2 Minuten!

---

## 🆘 Probleme?

### "config.js not found"
➜ Stelle sicher, dass `config.js` im Root-Ordner liegt

### Discord Login funktioniert nicht
➜ Prüfe die Redirect URI im Discord Developer Portal
➜ Muss EXAKT mit der URL in config.js übereinstimmen

### Bot antwortet nicht
➜ Prüfe ob der Bot auf Render.com läuft
➜ Prüfe die Bot URL in config.js
➜ Öffne Browser Console (F12) für Fehler

---

## 💡 Tipp: Lokales Testen

Der Code funktioniert weiterhin lokal:
- `http://localhost/quiz-lobby/` nutzt automatisch localhost URLs
- Keine Änderungen nötig für lokales Testen!

Die config.js erkennt automatisch ob du lokal oder online bist! 🎯

