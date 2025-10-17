// ========================================
// PEER-TO-PEER VERBINDUNG MIT PEERJS
// ========================================

class P2PConnection {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // playerId -> connection
    this.isHost = false;
    this.hostConnection = null;
    this.lobbyCode = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onGameStateUpdate = null;
    this.onMessageReceived = null;
    this.localPlayer = null;
  }

  // Host erstellt eine Lobby
  async createLobby(hostPlayer) {
    return new Promise((resolve, reject) => {
      // Generiere einen einzigartigen Lobby-Code (6 Zeichen)
      this.lobbyCode = this.generateLobbyCode();

      // Erstelle Peer mit dem Lobby-Code als ID
      this.peer = new Peer(this.lobbyCode, {
        debug: 2,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.isHost = true;
      this.localPlayer = hostPlayer;

      this.peer.on('open', (id) => {
        console.log('🎮 Lobby erstellt mit Code:', id);
        resolve(id);
      });

      this.peer.on('error', (error) => {
        console.error('❌ Peer Error:', error);
        reject(error);
      });

      // Lausche auf eingehende Verbindungen
      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });
    });
  }

  // Spieler tritt einer Lobby bei
  async joinLobby(lobbyCode, player) {
    return new Promise((resolve, reject) => {
      this.lobbyCode = lobbyCode;
      this.localPlayer = player;

      // Erstelle Peer mit zufälliger ID
      this.peer = new Peer({
        debug: 2,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('🔗 Verbinde mit Lobby:', lobbyCode);

        // Verbinde mit dem Host
        const conn = this.peer.connect(lobbyCode, {
          reliable: true,
          metadata: { player: player }
        });

        this.setupConnection(conn, true);
        this.hostConnection = conn;

        conn.on('open', () => {
          console.log('✅ Verbindung zum Host hergestellt');
          // Sende Spieler-Info an Host
          this.sendToHost({
            type: 'player-join',
            player: player
          });
          resolve(conn);
        });

        conn.on('error', (error) => {
          console.error('❌ Verbindungsfehler:', error);
          reject(error);
        });
      });

      this.peer.on('error', (error) => {
        console.error('❌ Peer Error:', error);
        reject(error);
      });
    });
  }

  // Host: Eingehende Verbindung behandeln
  handleIncomingConnection(conn) {
    console.log('👤 Neuer Spieler verbindet sich:', conn.peer);

    this.setupConnection(conn, false);

    conn.on('open', () => {
      const player = conn.metadata?.player || {
        id: conn.peer,
        username: 'Spieler_' + conn.peer.substring(0, 4)
      };

      this.connections.set(player.id, conn);

      // Sende aktuelle Lobby-Daten an neuen Spieler
      this.sendToPlayer(player.id, {
        type: 'lobby-state',
        host: this.localPlayer,
        players: Array.from(this.connections.keys()).map(id => ({
          id: id,
          ...this.connections.get(id).metadata?.player
        }))
      });

      // Benachrichtige alle über den neuen Spieler
      this.broadcast({
        type: 'player-joined',
        player: player
      });

      if (this.onPlayerJoined) {
        this.onPlayerJoined(player);
      }
    });
  }

  // Verbindungs-Events einrichten
  setupConnection(conn, isHost) {
    conn.on('data', (data) => {
      this.handleMessage(data, conn);
    });

    conn.on('close', () => {
      console.log('🔌 Verbindung geschlossen:', conn.peer);
      this.handleDisconnect(conn);
    });

    conn.on('error', (error) => {
      console.error('❌ Connection Error:', error);
    });
  }

  // Nachricht verarbeiten
  handleMessage(data, conn) {
    console.log('📨 Nachricht empfangen:', data);

    switch (data.type) {
      case 'player-join':
        if (this.isHost) {
          const player = data.player;
          this.connections.set(player.id, conn);
          conn.metadata = { player: player };
        }
        break;

      case 'lobby-state':
        // Empfange Lobby-Status vom Host
        if (!this.isHost && this.onGameStateUpdate) {
          this.onGameStateUpdate(data);
        }
        break;

      case 'player-joined':
        if (this.onPlayerJoined) {
          this.onPlayerJoined(data.player);
        }
        break;

      case 'player-left':
        if (this.onPlayerLeft) {
          this.onPlayerLeft(data.playerId);
        }
        break;

      case 'game-start':
        if (this.onMessageReceived) {
          this.onMessageReceived('game-start', data);
        }
        break;

      case 'question':
      case 'answer':
      case 'results':
        if (this.onMessageReceived) {
          this.onMessageReceived(data.type, data);
        }
        break;

      default:
        if (this.onMessageReceived) {
          this.onMessageReceived(data.type, data);
        }
    }
  }

  // Verbindung getrennt
  handleDisconnect(conn) {
    // Versuche zuerst, die Player-ID aus den Metadaten zu nutzen
    let playerId = conn?.metadata?.player?.id || null;

    // Falls keine Metadata-ID vorhanden ist, nutze conn.peer als Fallback
    if (!playerId) {
      playerId = conn.peer || null;
    }

    if (this.isHost) {
      // Falls der gefundene playerId nicht als Key existiert, suche den Map-Eintrag
      if (playerId && !this.connections.has(playerId)) {
        for (const [id, c] of this.connections.entries()) {
          if (c === conn) {
            playerId = id;
            break;
          }
        }
      }

      // Entferne den Spieler-Eintrag aus der Map (falls vorhanden)
      if (playerId && this.connections.has(playerId)) {
        this.connections.delete(playerId);
      } else {
        // Notfall: entferne alle Einträge, die auf dasselbe Connection-Objekt zeigen
        for (const [id, c] of Array.from(this.connections.entries())) {
          if (c === conn) {
            this.connections.delete(id);
          }
        }
      }

      // Benachrichtige andere Spieler (wenn wir eine ID ermitteln konnten, sende sie)
      this.broadcast({
        type: 'player-left',
        playerId: playerId
      });

      if (this.onPlayerLeft) {
        this.onPlayerLeft(playerId);
      }
    } else {
      // Spieler: Host getrennt
      console.log('❌ Verbindung zum Host verloren');
      if (this.onMessageReceived) {
        this.onMessageReceived('host-disconnected', {});
      }
    }
  }

  // Nachricht an einen Spieler senden (Host)
  sendToPlayer(playerId, data) {
    if (!this.isHost) return;

    const conn = this.connections.get(playerId);
    if (conn && conn.open) {
      conn.send(data);
    }
  }

  // Nachricht an Host senden (Spieler)
  sendToHost(data) {
    if (this.isHost) return;

    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(data);
    }
  }

  // Nachricht an alle Spieler senden (Host)
  broadcast(data) {
    if (!this.isHost) return;

    // Sende nur an offene Verbindungen. Entferne geschlossene/verwaiste Conns
    for (const [playerId, conn] of Array.from(this.connections.entries())) {
      if (conn && conn.open) {
        try {
          conn.send(data);
        } catch (e) {
          console.warn('Fehler beim Senden an', playerId, e);
        }
      } else {
        // Verbindung ist geschlossen oder ungültig -> entfernen
        this.connections.delete(playerId);
      }
    }
  }

  // Lobby-Code generieren
  generateLobbyCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Alle Spieler abrufen
  getPlayers() {
    if
