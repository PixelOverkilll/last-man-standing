// Extended Puppeteer smoke test
const fs = require('fs');
const puppeteer = require('puppeteer');

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

(async () => {
  const url = 'https://pixeloverkilll.github.io/last-man-standing/';
  const out = [];

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    const fakeUser = { id: 'test-1', username: 'TestUser', discriminator: '0001', avatar: '' };
    try { localStorage.setItem('discordUser', JSON.stringify(fakeUser)); } catch(e) {}
    try { localStorage.setItem('discordToken', 'fake-token'); } catch(e) {}
    window.prompt = function() { return 'PXL339'; };

    // capture console logs
    const origLog = console.log;
    console.log = function() { origLog.apply(console, arguments); };
  });

  page.on('console', msg => {
    const text = msg.text();
    const outLine = `[PAGE] ${text}`;
    out.push(outLine);
    console.log(outLine);
  });

  page.on('pageerror', err => {
    const outLine = `[PAGE-ERROR] ${err.toString()}`;
    out.push(outLine);
    console.error(outLine);
  });

  page.on('requestfailed', req => {
    const failure = req.failure ? (req.failure().errorText || JSON.stringify(req.failure())) : 'unknown';
    const outLine = `[REQ-FAILED] ${req.url()} ${failure}`;
    out.push(outLine);
    console.warn(outLine);
  });

  console.log('Opening page:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  await sleep(2000);

  const ioType = await page.evaluate(() => typeof window.io);
  out.push('[EVAL] typeof io = ' + ioType);
  console.log('[EVAL] typeof io =', ioType);

  const socketPresent = await page.evaluate(() => !!window.__LMS_SOCKET);
  out.push('[EVAL] window.__LMS_SOCKET present = ' + socketPresent);
  console.log('[EVAL] window.__LMS_SOCKET present =', socketPresent);

  try {
    await page.waitForSelector('#create-lobby-btn', { timeout: 5000 });
    console.log('Clicking create button via evaluate()...');
    await page.evaluate(() => { const b = document.getElementById('create-lobby-btn'); if (b) b.click(); });

    // Wait up to 20s for location to include lobby.html?code=
    const maxWait = 20000;
    const start = Date.now();
    let navigated = false;
    while (Date.now() - start < maxWait) {
      const href = await page.evaluate(() => window.location.href);
      if (href && href.indexOf('lobby.html?code=') !== -1) { navigated = true; out.push('Detected navigation to ' + href); break; }
      // Also check localStorage
      const lobbyCode = await page.evaluate(() => { try { return localStorage.getItem('lobbyCode'); } catch(e) { return null; } });
      const isHost = await page.evaluate(() => { try { return localStorage.getItem('isHost'); } catch(e) { return null; } });
      out.push(`[CHECK] href=${href} lobbyCode=${lobbyCode} isHost=${isHost}`);
      if (lobbyCode) { break; }
      await sleep(500);
    }

    const finalHref = await page.evaluate(() => window.location.href);
    out.push('Final href: ' + finalHref);

    const finalLobbyCode = await page.evaluate(() => { try { return localStorage.getItem('lobbyCode'); } catch(e) { return null; } });
    const finalIsHost = await page.evaluate(() => { try { return localStorage.getItem('isHost'); } catch(e) { return null; } });
    out.push('Final localStorage lobbyCode=' + finalLobbyCode + ' isHost=' + finalIsHost);

  } catch (err) {
    console.error('Error during create-click/navigation test:', err.message || err);
    out.push('Error during create-click/navigation test: ' + (err.message || err));
  }

  const logPath = 'server/puppeteer-console-extended.log';
  fs.writeFileSync(logPath, out.join('\n'), 'utf8');
  console.log('Saved console log to', logPath);

  await browser.close();
  process.exit(0);
})();

