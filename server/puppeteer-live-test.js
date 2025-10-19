const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'https://last-man-standing-1.onrender.com/lobby.html?code=SZ038G';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait a bit in case scripts set localStorage then update DOM
    await page.waitForTimeout(800);

    const result = await page.evaluate(() => {
      function safeGet(id) { const el = document.getElementById(id); return el ? (el.src || el.textContent || el.value || '') : null; }
      const hostAvatarSrc = safeGet('host-avatar');
      const hostNameText = (() => { const el = document.getElementById('host-name'); return el ? el.textContent.trim() : null; })();

      const hostPlayer = (() => { try { return JSON.parse(localStorage.getItem('hostPlayer') || 'null'); } catch (e) { return null; } })();
      const isHost = localStorage.getItem('isHost');
      const lobbyCode = localStorage.getItem('lobbyCode');

      // debug overlay values
      const dbgSocket = document.getElementById('dbg-socket') ? document.getElementById('dbg-socket').textContent : null;
      const dbgIsHost = document.getElementById('dbg-isHost') ? document.getElementById('dbg-isHost').textContent : null;
      const dbgUser = document.getElementById('dbg-user') ? document.getElementById('dbg-user').textContent : null;

      return {
        url: location.href,
        hostAvatarSrc,
        hostNameText,
        hostPlayer,
        isHost,
        lobbyCode,
        dbgSocket,
        dbgIsHost,
        dbgUser
      };
    });

    console.log('LIVE_TEST_RESULT:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('TEST_ERROR:', err && err.message ? err.message : err);
  } finally {
    await browser.close();
  }
})();

