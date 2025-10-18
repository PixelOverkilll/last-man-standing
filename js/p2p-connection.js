// ========================================
// SOCKET.IO-BASED P2P CONNECTION
// ========================================

class P2PConnection {
  constructor() {
    this.socket = null;
    this.isHost = false;
    this.lobbyCode = null;
    this.connections = new Map(); // socketId -> player

    // Callbacks
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onGameStateUpdate = null;
    this.onMessageReceived = null;
    this.localPlayer = null;
  }

  ensureSocket() {
    if (this.socket) return this.socket;
    if (window && window.__LMS_SOCKET) {
      this.socket = window.__LMS_SOCKET;
    } else if (typeof io !== 'undefined') {
      this.socket = io();
      window.__LMS_SOCKET = this.socket;
    } else {
      throw new Error('Socket.IO client not available');
    }
    this.attachHandlers();
    return this.socket;
  }

  attachHandlers() {
    const s = this.socket;
    if (!s) return;

    s.on('lobby-state', (data) => {
      // Replace local players map
      if (Array.isArray(data.players)) {
        this.connections.clear();
        data.players.forEach(p => {
          this.connections.set(p.id, p);
        });
      }
      if (this.onGameStateUpdate) this.onGameStateUpdate(data);
    });

    s.on('player-joined', (payload) => {
      const p = payload.player;
      this.connections.set(p.id, p);
      if (this.onPlayerJoined) this.onPlayerJoined(p);
    });

    s.on('player-left', (payload) => {
      const id = payload.playerId;
      this.connections.delete(id);
      if (this.onPlayerLeft) this.onPlayerLeft(id);
    });

    // Generic messages forwarded to onMessageReceived
    s.on('game-start', (data) => { if (this.onMessageReceived) this.onMessageReceived('game-start', data); });
    s.on('eval', (data) => { if (this.onMessageReceived) this.onMessageReceived('eval', data); });
    s.on('score-update', (data) => { if (this.onMessageReceived) this.onMessageReceived('score-update', data); });
  }

  // Host erstellt eine Lobby
  async createLobby(hostPlayer) {
    this.ensureSocket();
    this.localPlayer = hostPlayer || { id: null, name: 'Host' };
    return new Promise((resolve, reject) => {
      this.socket.emit('create-lobby', { player: this.localPlayer }, (res) => {
        if (!res || !res.ok) return reject(res);
        this.isHost = true;
        this.lobbyCode = res.lobbyId;
        resolve(this.lobbyCode);
      });
    });
  }

  // Spieler tritt einer Lobby bei
  async joinLobby(lobbyCode, player) {
    this.ensureSocket();
    this.localPlayer = player || { id: null, name: 'Spieler' };
    return new Promise((resolve, reject) => {
      this.socket.emit('join-lobby', { lobbyId: lobbyCode, player: this.localPlayer }, (res) => {
        if (!res || !res.ok) return reject(res);
        this.isHost = false;
        this.lobbyCode = lobbyCode;
        resolve(res);
      });
    });
  }

  // Nachricht an einen Spieler (targetId == socketId)
  sendToPlayer(playerId, data) {
    if (!this.lobbyCode) return;
    this.ensureSocket().emit('lobby-message', { lobbyId: this.lobbyCode, type: data.type || 'message', data: data, targetId: playerId });
  }

  // Nachricht an alle (Host) oder an Server zum Broadcast
  broadcast(data) {
    if (!this.lobbyCode) return;
    this.ensureSocket().emit('lobby-message', { lobbyId: this.lobbyCode, type: data.type || 'broadcast', data: data });
  }

  // Nachricht an Host
  sendToHost(data) {
    if (!this.lobbyCode) return;
    this.ensureSocket().emit('lobby-message', { lobbyId: this.lobbyCode, type: data.type || 'to-host', data: data, target: 'host' });
  }

  updatePlayerInfo(playerId, info) {
    // Local update; server authoritative storage can be added
    const p = this.connections.get(playerId);
    if (p) {
      const merged = { ...p, ...info };
      this.connections.set(playerId, merged);
    }
    // Inform server/others
    this.ensureSocket().emit('lobby-message', { lobbyId: this.lobbyCode, type: 'player-update', data: { playerId, info } });
  }

  generateLobbyCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  disconnect() {
    try {
      if (this.socket) {
        this.socket.disconnect();
      }
    } catch (e) {}
    this.socket = null;
    this.connections.clear();
    this.isHost = false;
    this.lobbyCode = null;
  }
}

// Exportiere für Node/CommonJS und setze global für Browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = P2PConnection;
}
if (typeof window !== 'undefined') {
  window.P2PConnection = P2PConnection;
}
