# 🎯 WICHTIGER STAND - PEER-TO-PEER FUNKTIONIERT

**Datum:** 2025-01-16
**Status:** ✅ FUNKTIONSFÄHIG - P2P-Verbindung läuft

---

## 📋 Was funktioniert

### ✅ Peer-to-Peer Verbindung
- **Host hostet Server direkt auf seinem PC** - Kein externer Server nötig
- **Spieler verbinden sich direkt mit dem Host** - Über WebRTC
- **Echtzeit-Synchronisation** - Alle Änderungen werden sofort übertragen
- **NAT-Traversal** - Nutzt Google STUN-Server für Verbindung durch Router

### ✅ Lobby-System
- **Host erstellt Lobby** - Generiert 6-stelligen Code
- **Spieler treten bei** - Mit Lobby-Code
- **Host ist separiert** - Erscheint nur oben als "👑 HOST", nicht in Spielerliste
- **Discord-Integration** - Alle sehen Discord-Namen und Avatare

### ✅ Implementierte Features
1. **Discord OAuth2 Login** - Vollständig funktional
2. **Lobby-Erstellung** - Host erstellt Code (z.B. "ABC123")
3. **Lobby-Beitritt** - Spieler geben Code ein
4. **Echtzeit-Updates** - Spieler sehen sich gegenseitig
5. **Disconnect-Handling** - Wenn Spieler gehen, werden andere benachrichtigt
6. **Host-Info-Anzeige** - Oben links mit Krone
7. **Spieler-Liste** - Unten mit Discord-Avataren

---

## 🔧 Technische Details

### PeerJS Setup
- **Version:** 1.5.2
- **CDN:** unpkg.com mit Fallback auf jsdelivr.net
- **STUN-Server:**
  - stun.l.google.com:19302
  - stun1.l.google.com:19302

### Datei-Struktur
```
js/
  ├── app.js              # Startseite mit Discord Login
  ├── lobby.js            # Lobby-System mit P2P
  ├── p2p-connection.js   # P2P-Verbindungsmodul (nicht aktiv verwendet)
  └── vendor/

lobby.html                # Lobby-Seite
index.html                # Startseite
config.js                 # Konfiguration
```

### P2P-Architektur

**Host:**
```javascript
// Erstellt Peer mit Lobby-Code als ID
peer = new Peer(lobbyCode)

// Lauscht auf eingehende Verbindungen
peer.on('connection', (conn) => {
  handleIncomingConnection(conn)
})

// Sendet Daten an alle Spieler
broadcast({ type: 'message', data: ... })
```

**Spieler:**
```javascript
// Verbindet sich mit Host
peer = new Peer() // Zufällige ID
conn = peer.connect(lobbyCode)

// Empfängt Daten vom Host
conn.on('data', (data) => {
  handleMessage(data)
})
```

---

## 📡 Nachrichten-Protokoll

### Host → Spieler

#### `lobby-state`
```javascript
{
  type: 'lobby-state',
  host: {
    name: 'Discord Name',
    avatar: 'https://cdn.discordapp.com/...'
  },
  players: [
    { id, name, avatar, score, isHost: false },
    ...
  ]
}
```

#### `player-joined`
```javascript
{
  type: 'player-joined',
  player: { id, name, avatar, score }
}
```

#### `player-left`
```javascript
{
  type: 'player-left',
  playerId: 'player-id'
}
```

#### `game-start`
```javascript
{
  type: 'game-start',
  timestamp: Date.now()
}
```

---

## 🎮 Benutzer-Flow

### Als Host:
1. Discord Login auf index.html
2. Klick auf "Neue Lobby"
3. Lobby wird erstellt mit Code (z.B. "49VBSQ")
4. Host sieht sich oben links als "👑 HOST"
5. Wartet auf Spieler
6. Sieht beitretende Spieler unten
7. Kann Quiz starten (min. 1 Spieler nötig)

### Als Spieler:
1. Discord Login auf index.html
2. Lobby-Code eingeben (z.B. "49VBSQ")
3. Klick auf "Beitreten"
4. Verbindung zum Host wird hergestellt
5. Sieht Host oben links mit Discord-Daten
6. Sieht sich selbst und andere Spieler unten
7. Wartet auf Quiz-Start vom Host

---

## 🐛 Bekannte Probleme (BEHOBEN)

### ✅ Host wurde nicht korrekt angezeigt
**Problem:** Spieler sahen "Host lädt..." statt Discord-Daten
**Lösung:** Host-Daten werden jetzt direkt aus `currentUser` gesendet

### ✅ Host war gleichzeitig Spieler
**Problem:** Host erschien in Spielerliste
**Lösung:** Host wird nur noch oben angezeigt, nicht in Spielerliste

### ✅ Lobby-Code wurde nicht verwendet
**Problem:** Host generierte neuen Code statt URL-Code zu nutzen
**Lösung:** Host nutzt jetzt den Code aus der URL

---

## 📂 Wichtige Code-Abschnitte

### Host erstellt Lobby (lobby.js, Zeile ~158)
```javascript
async function createLobby(code) {
  peer = new Peer(code, {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  peer.on('open', (id) => {
    lobbyCode = id;
    console.log('✅ P2P-Lobby erstellt mit Code:', id);
    resolve(id);
  });

  peer.on('connection', (conn) => {
    handleIncomingConnection(conn);
  });
}
```

### Spieler tritt bei (lobby.js, Zeile ~192)
```javascript
async function joinLobby(code) {
  peer = new Peer({
    debug: 2,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  peer.on('open', (id) => {
    const conn = peer.connect(code, {
      reliable: true,
      metadata: {
        player: {
          id: id,
          name: currentUser.global_name || currentUser.username,
          avatar: getUserAvatar(currentUser),
          score: 0,
          isHost: false
        }
      }
    });

    hostConnection = conn;
  });
}
```

### Host sendet Lobby-State (lobby.js, Zeile ~267)
```javascript
conn.send({
  type: 'lobby-state',
  host: {
    name: currentUser.global_name || currentUser.username,
    avatar: getUserAvatar(currentUser)
  },
  players: Array.from(players.values())
});
```

---

## 🚀 Deployment

### Lokal testen:
```bash
# Einfach HTML-Dateien im Browser öffnen
file:///C:/Users/Crave/IdeaProjects/Last man standing/index.html
```

### GitHub Pages:
```
https://pixeloverkilll.github.io/last-man-standing/
```

**Wichtig:** Nach Git Push dauert Deployment 1-2 Minuten

### Git Commands:
```bash
git add .
git commit -m "Nachricht"
git push
```

---

## 📝 Nächste Schritte (Optional)

1. **Quiz-Logik implementieren**
   - Fragen laden
   - Antworten validieren
   - Punkte vergeben

2. **Voice-Channel Integration**
   - Discord Voice State auslesen
   - Nur Spieler im Voice-Channel erlauben

3. **Erweiterte Features**
   - Spieler-Kick (Host)
   - Lobby-Einstellungen
   - Verschiedene Quiz-Modi

---

## ⚠️ NICHT ÄNDERN

Diese Funktionen sind **kritisch** und funktionieren:

1. **PeerJS-Einbindung** in index.html und lobby.html
2. **createLobby()** Funktion - Host-Erstellung
3. **joinLobby()** Funktion - Spieler-Beitritt
4. **handleIncomingConnection()** - Verbindungsbehandlung
5. **broadcast()** - Nachrichten an alle Spieler
6. **Host-Daten-Übertragung** mit currentUser

---

## 🔗 Wichtige Links

- **GitHub Repo:** https://github.com/PixelOverkilll/last-man-standing
- **Live Demo:** https://pixeloverkilll.github.io/last-man-standing/
- **PeerJS Docs:** https://peerjs.com/docs/

---

## 📞 Support

Bei Problemen:
1. Browser-Konsole öffnen (F12)
2. Nach Fehlermeldungen suchen
3. PeerJS-Logs prüfen (debug: 1 oder 2)

**Letzte Aktualisierung:** 2025-01-16
**Version:** 1.0 - P2P Funktionsfähig ✅

