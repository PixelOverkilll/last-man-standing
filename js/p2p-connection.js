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

      // Verbesserte Fehlerbehandlung für PeerJS-Verbindungen
      this.peer.on('error', (error) => {
        console.error('❌ Peer Error beim Erstellen der Lobby:', error);
        switch (error.type) {
          case 'unavailable-id':
            console.error('⚠️ Der Lobby-Code ist bereits vergeben. Versuche es erneut.');
            alert('Lobby-Code bereits vergeben. Bitte erneut versuchen.');
            break;
          case 'network':
            console.error('⚠️ Netzwerkfehler. Überprüfen Sie Ihre Verbindung.');
            alert('Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.');
            break;
          default:
            console.error('⚠️ Ein unbekannter Fehler ist aufgetreten:', error.message);
            alert('Ein unbekannter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
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

        // Zusätzliche Fehlerbehandlung für Verbindungsprobleme
        conn.on('error', (error) => {
          console.error('❌ Verbindungsfehler:', error);
          if (error.message.includes('disconnected')) {
            console.error('⚠️ Verbindung wurde unerwartet getrennt.');
          } else {
            console.error('⚠️ Ein unbekannter Verbindungsfehler ist aufgetreten:', error.message);
          }
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
    try {
      if (!data || typeof data.type !== 'string') {
        throw new Error('Ungültige Nachricht erhalten.');
      }
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
    } catch (error) {
      console.error('❌ Fehler bei der Nachrichtenverarbeitung:', error.message);
    }
  }

  // Verbindung getrennt
  handleDisconnect(conn) {
    const playerId = conn.peer;

    if (this.isHost) {
      // Host: Entferne Spieler
      this.connections.delete(playerId);

      // Benachrichtige andere Spieler
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
    if (conn) {
      conn.send(data);
      console.log('📤 Nachricht gesendet an', playerId, ':', data);
    } else {
      console.error('❌ Verbindung zu Spieler', playerId, 'nicht gefunden.');
    }
  }

  // Nachricht an alle Spieler senden (Host)
  broadcast(data) {
    if (!this.isHost) return;

    this.connections.forEach((conn) => {
      conn.send(data);
    });
    console.log('📢 Nachricht an alle gesendet:', data);
  }

  // Spielerinformationen aktualisieren
  updatePlayerInfo(playerId, info) {
    const conn = this.connections.get(playerId);
    if (conn) {
      conn.metadata = { player: { ...conn.metadata.player, ...info } };
      console.log('🔄 Spielerinfo aktualisiert für', playerId, ':', info);
    }
  }

  // Lobby-Code generieren (einfaches Beispiel)
  generateLobbyCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Verbindung schließen
  disconnect() {
    try {
      // Host: alle Client-Verbindungen schließen
      if (this.isHost) {
        if (this.connections && this.connections.size) {
          this.connections.forEach((conn) => {
            try {
              if (conn && conn.open) conn.close();
            } catch (e) {
              console.warn('Warnung beim Schließen einer Client-Verbindung:', e);
            }
          });
          this.connections.clear();
        }
      } else {
        // Spieler: Verbindung zum Host schließen
        if (this.hostConnection) {
          try {
            if (this.hostConnection.open) this.hostConnection.close();
          } catch (e) {
            console.warn('Warnung beim Schließen der hostConnection:', e);
          }
          this.hostConnection = null;
        }
      }

      // Peer aufräumen: Listener entfernen, disconnect/destroy aufrufen
      if (this.peer) {
        try {
          if (typeof this.peer.removeAllListeners === 'function') {
            try { this.peer.removeAllListeners(); } catch (e) { /* ignore */ }
          }
          if (typeof this.peer.disconnect === 'function') {
            try { this.peer.disconnect(); } catch (e) { /* ignore */ }
          }
          if (typeof this.peer.destroy === 'function') {
            try { this.peer.destroy(); } catch (e) { /* ignore */ }
          }
        } catch (e) {
          console.warn('Warnung beim Aufräumen des Peer-Objekts:', e);
        }
        this.peer = null;
      }

      // Reset interne Zustände
      this.isHost = false;
      this.hostConnection = null;
      this.lobbyCode = null;
      this.localPlayer = null;

      console.log('🔌 P2P-Verbindungen wurden sauber geschlossen');
    } catch (error) {
      console.error('❌ Fehler beim Trennen der P2P-Verbindung:', error);
    }
  }
}

module.exports = P2PConnection;
