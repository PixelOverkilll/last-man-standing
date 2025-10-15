# Discord Bot Setup - Last Man Standing

## Schritt 1: Discord Bot erstellen

1. Gehe zu https://discord.com/developers/applications
2. Klicke auf "New Application"
3. Gib einen Namen ein (z.B. "Last Man Standing Bot")
4. Gehe zu "Bot" im linken Menü
5. Klicke auf "Add Bot"
6. **Wichtig**: Aktiviere diese Privileged Gateway Intents:
   - ✅ PRESENCE INTENT
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT

## Schritt 2: Bot-Token kopieren

1. Unter "Bot" klicke auf "Reset Token"
2. Kopiere den Token (zeigt nur einmal!)
3. Füge den Token in `discord-bot.js` ein (Zeile 8):
   ```javascript
   const BOT_TOKEN = 'HIER_DEINEN_NEUEN_TOKEN_EINFÜGEN';
   ```

**WICHTIG**: Teile deinen Token NIEMALS öffentlich!

## Schritt 3: Bot einladen

1. Gehe zu "OAuth2" > "URL Generator"
2. Wähle diese Scopes:
   - ✅ bot
3. Wähle diese Bot Permissions:
   - ✅ View Channels
   - ✅ Connect
   - ✅ Speak
4. Kopiere die generierte URL und öffne sie im Browser
5. Wähle deinen Discord-Server aus und autorisiere den Bot

## Schritt 4: Dependencies installieren

Öffne ein Terminal im `bot` Ordner und führe aus:
```bash
cd "C:\Users\Crave\IdeaProjects\Last man standing\bot"
npm install
```

## Schritt 5: Bot starten

```bash
npm start
```

Der Bot sollte jetzt online sein und Voice-States tracken!

## API Endpoints

Der Bot erstellt folgende Endpoints auf `http://localhost:3000`:

- `GET /api/voice-states` - Alle User im Voice
- `GET /api/voice-state/:userId` - Status eines bestimmten Users
- `GET /api/voice-channel/:channelId` - Alle User in einem Channel
- `GET /api/speaking/:userId` - Prüft ob User spricht
- `GET /api/health` - Bot-Status

## Integration in deine Web-App

Die Web-App kann jetzt Voice-States abfragen:
```javascript
// Beispiel
const response = await fetch('http://localhost:3000/api/voice-states');
const voiceUsers = await response.json();
```

## Troubleshooting

### Bot geht nicht online
- Prüfe ob der Bot-Token korrekt ist
- Stelle sicher dass alle Intents aktiviert sind

### Keine Voice-States erkannt
- Bot muss auf dem Server sein
- Bot braucht "View Channels" Permission

### CORS-Fehler
- Der Bot läuft mit CORS aktiviert
- Falls Probleme: Prüfe die Browser-Konsole
