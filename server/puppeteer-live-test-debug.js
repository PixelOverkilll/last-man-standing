const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'https://last-man-standing-1.onrender.com/lobby.html?code=SZ038G';
  const outScreenshot = 'server/puppeteer-live-test.png';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);

  // helper for waiting that works across Puppeteer versions
  const waitForMs = async (ms) => {
    if (typeof page.waitForTimeout === 'function') return page.waitForTimeout(ms);
    if (typeof page.waitFor === 'function') return page.waitFor(ms);
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const consoleMessages = [];
  page.on('console', msg => {
    try { consoleMessages.push({ type: msg.type(), text: msg.text() }); } catch (e) {}
  });
  const pageErrors = [];
  page.on('pageerror', err => { pageErrors.push(err.message); });

  // collect network failures and responses for debugging CDN/load issues
  const requestsFailed = [];
  page.on('requestfailed', req => {
    try {
      const f = req.failure ? req.failure() : null;
      requestsFailed.push({ url: req.url(), method: req.method(), errorText: f && f.errorText ? f.errorText : (f && f.message ? f.message : null) });
    } catch (e) {}
  });
  const responses = [];
  const pendingResponseTextPromises = [];
  page.on('response', res => {
    try {
      const req = res.request();
      const entry = { url: res.url(), status: res.status(), ok: res.ok && res.ok(), fromCache: res.fromCache && res.fromCache(), method: req.method(), headers: res.headers() };
      // if it's the socket.io CDN script, also capture a small snippet of the body for inspection
      if (res.url().includes('cdn.socket.io') || res.url().includes('socket.io.min.js')) {
        const p = res.text().then(t => {
          entry.bodySnippet = t ? t.substring(0, 1024) : null;
          responses.push(entry);
        }).catch(()=>{ responses.push(entry); });
        pendingResponseTextPromises.push(p);
      } else {
        responses.push(entry);
      }
    } catch (e) {}
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    // wait a bit to allow client scripts to run
    await waitForMs(1200);

    // take screenshot
    await page.screenshot({ path: outScreenshot, fullPage: true }).catch(()=>{});

    const result = await page.evaluate(() => {
      function safeGet(id) { const el = document.getElementById(id); return el ? (el.src || el.textContent || el.value || '') : null; }
      const hostAvatarSrc = safeGet('host-avatar');
      const hostNameText = (() => { const el = document.getElementById('host-name'); return el ? el.textContent.trim() : null; })();

      const hostPlayer = (() => { try { return JSON.parse(localStorage.getItem('hostPlayer') || 'null'); } catch (e) { return null; } })();
      const isHost = localStorage.getItem('isHost');
      const lobbyCode = localStorage.getItem('lobbyCode');

      const dbgSocket = document.getElementById('dbg-socket') ? document.getElementById('dbg-socket').textContent : null;
      const dbgIsHost = document.getElementById('dbg-isHost') ? document.getElementById('dbg-isHost').textContent : null;
      const dbgUser = document.getElementById('dbg-user') ? document.getElementById('dbg-user').textContent : null;

      // gather script tag state and window.io type
      const scripts = Array.from(document.getElementsByTagName('script')).map(s => ({ src: s.src || null, type: s.type || null, async: !!s.async, defer: !!s.defer, hasInline: s.innerHTML && s.innerHTML.trim().length > 0 }));
      const windowIoType = typeof window.io;
      const windowIoExists = !!window.io;

      return {
        url: location.href,
        hostAvatarSrc,
        hostNameText,
        hostPlayer,
        isHost,
        lobbyCode,
        dbgSocket,
        dbgIsHost,
        dbgUser,
        windowIoType,
        windowIoExists,
        scripts
      };
    });

    // ensure any pending response text reads have finished so bodySnippet is present
    try { await Promise.all(pendingResponseTextPromises); } catch(e) {}

    console.log('LIVE_TEST_RESULT:', JSON.stringify(result, null, 2));
    console.log('PAGE_CONSOLE:', JSON.stringify(consoleMessages, null, 2));
    if (pageErrors.length) console.log('PAGE_ERRORS:', JSON.stringify(pageErrors, null, 2));
    if (requestsFailed.length) console.log('PAGE_REQUESTS_FAILED:', JSON.stringify(requestsFailed, null, 2));
    if (responses.length) console.log('PAGE_RESPONSES:', JSON.stringify(responses, null, 2));
    console.log('SCREENSHOT:', outScreenshot);
  } catch (err) {
    console.error('TEST_ERROR:', err && err.message ? err.message : err);
  } finally {
    await browser.close();
  }
})();
