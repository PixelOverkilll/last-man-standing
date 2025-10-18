// Client-seitiger Socket.IO-Connector
(function() {
  const socket = io();

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

