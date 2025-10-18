// Client-seitiger Socket.IO-Connector
(function() {
  // Versuche, eine Socket-Verbindung aufzubauen.
  // Priorität: CONFIG.getSocketUrl() (wenn verfügbar) -> io(socketUrl)
  // Fallback: io() (verwendet vom bestehenden Code)

  let socket;
  try {
    const ioAvailable = typeof io === 'function';
    const configAvailable = typeof CONFIG !== 'undefined' && CONFIG && typeof CONFIG.getSocketUrl === 'function';
    const socketUrl = configAvailable ? CONFIG.getSocketUrl() : null;

    if (!ioAvailable) {
      console.error('[socket-client] socket.io client (io) ist nicht verfügbar auf dieser Seite');
      return;
    }

    if (socketUrl) {
      try {
        console.log('[socket-client] verbinde mit CONFIG Socket URL:', socketUrl);
        socket = io(socketUrl, { transports: ['websocket', 'polling'] });
      } catch (err) {
        console.warn('[socket-client] verbindung zu CONFIG Socket URL fehlgeschlagen, versuche default io():', err);
        socket = io();
      }
    } else {
      console.log('[socket-client] keine CONFIG Socket URL gefunden, verwende default io()');
      socket = io();
    }
  } catch (err) {
    console.error('[socket-client] Fehler beim Initialisieren des Sockets:', err);
    return;
  }

  socket.on('connect', () => {
    console.log('[socket-client] verbunden mit id', socket.id);
  });

  socket.on('player-joined', (data) => {
    console.log('[socket-client] player-joined', data);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[socket-client] getrennt:', reason);
  });

  // Buttons in der UI anbringen (falls vorhanden)
  function safeQuery(id) { return document.getElementById(id); }

  const createBtn = safeQuery('create-lobby-btn');
  const joinBtn = safeQuery('join-lobby-btn');
  const lobbyInput = safeQuery('lobby-code');

  if (createBtn) {
    createBtn.addEventListener('click', () => {
      socket.emit('create-lobby', { mode: 'default' }, (res) => {
        console.log('[socket-client] create-lobby result', res);
        if (res && res.lobbyId) {
          alert('Lobby erstellt: ' + res.lobbyId);
        }
      });
    });
  }

  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const code = lobbyInput ? lobbyInput.value.trim() : '';
      if (!code) return alert('Bitte Lobby-Code eingeben');
      socket.emit('join-lobby', { lobbyId: code }, (res) => {
        console.log('[socket-client] join-lobby result', res);
        if (res && res.ok) {
          alert('Lobby beigetreten: ' + code);
        }
      });
    });
  }

  // Expose for dev console
  window.__LMS_SOCKET = socket;
})();
