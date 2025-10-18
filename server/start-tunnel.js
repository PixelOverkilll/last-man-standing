// start-tunnel.js
// Startet localtunnel programmgesteuert und gibt die öffentliche URL aus.
// Usage: node server/start-tunnel.js [subdomain]

const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

async function updateConfigWithTunnelUrl(tunnelUrl) {
  try {
    const cfgPath = path.join(__dirname, '..', 'config.js');
    const backupPath = cfgPath + '.bak';
    if (!fs.existsSync(cfgPath)) {
      console.warn('config.js nicht gefunden unter', cfgPath);
      return;
    }
    const orig = fs.readFileSync(cfgPath, 'utf8');
    // Erstelle Backup
    fs.writeFileSync(backupPath, orig, 'utf8');

    // Finde den SOCKET.BASE_URL Block und ersetze nur production: '...' innerhalb dieses Blocks
    const socketBlockRegex = /(SOCKET\s*:\s*{\s*BASE_URL\s*:\s*{)([\s\S]*?)(}\s*}\s*,?)/m;
    const m = orig.match(socketBlockRegex);
    if (!m) {
      console.warn('Konnte SOCKET.BASE_URL Block in config.js nicht finden; keine Änderung vorgenommen. (Backup wurde erstellt)');
      return;
    }

    const before = m[1];
    const inner = m[2];
    const after = m[3];

    const newInner = inner.replace(/production\s*:\s*'[^']*'/, `production: '${tunnelUrl}'`);

    if (newInner === inner) {
      console.warn('Keine production-Eintragung im SOCKET.BASE_URL Block gefunden; keine Änderung vorgenommen. (Backup: ' + backupPath + ')');
      return;
    }

    const replaced = orig.replace(socketBlockRegex, before + newInner + after);
    fs.writeFileSync(cfgPath, replaced, 'utf8');
    console.log('config.js aktualisiert: SOCKET.BASE_URL.production =', tunnelUrl);
  } catch (err) {
    console.error('Fehler beim Aktualisieren von config.js:', err);
  }
}

(async () => {
  try {
    const port = process.env.PORT || 3000;
    const subdomain = process.argv[2] || undefined;
    const opts = subdomain ? { port, subdomain } : { port };
    const tunnel = await localtunnel(opts);
    console.log('Public URL:', tunnel.url);
    console.log('Subdomain:', tunnel.url && tunnel.url.split('//')[1].split('.')[0]);

    // Versuche, die config.js mit der öffentlichen URL zu aktualisieren
    await updateConfigWithTunnelUrl(tunnel.url);

    tunnel.on('close', () => {
      console.log('Tunnel closed');
      process.exit(0);
    });
    // keep process alive
    process.stdin.resume();
  } catch (err) {
    console.error('Failed to start tunnel:', err);
    process.exit(1);
  }
})();
