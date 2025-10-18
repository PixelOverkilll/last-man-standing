// Simple Puppeteer smoke test for Last Man Standing production page
// - loads the GitHub Pages site
// - captures console logs
// - clicks the "Neue Lobby erstellen" button and waits for responses

const fs = require('fs');
const puppeteer = require('puppeteer');

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

(async () => {
  const url = 'https://pixeloverkilll.github.io/last-man-standing/';
  const out = [];

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Ensure localStorage and prompt override are in place before any scripts run
  await page.evaluateOnNewDocument(() => {
    // Simulate a logged-in Discord user and token
    const fakeUser = { id: 'test-1', username: 'TestUser', discriminator: '0001', avatar: '' };
    try { localStorage.setItem('discordUser', JSON.stringify(fakeUser)); } catch(e) {}
    try { localStorage.setItem('discordToken', 'fake-token'); } catch(e) {}

    // Auto-answer the admin password prompt correctly
    window.prompt = function() { return 'PXL339'; };
  });

  page.on('console', msg => {
    const text = msg.text();
    const location = msg.location ? `${msg.location.url}:${msg.location.lineNumber}` : '';
    const outLine = `[PAGE] ${text} ${location}`;
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

  // Give page a little time to load socket.io client and connect
  await sleep(2000);

  // Verify io and socket presence on main page
  const ioType = await page.evaluate(() => typeof window.io);
  console.log('[EVAL] typeof io =', ioType);
  out.push('[EVAL] typeof io = ' + ioType);

  const socketPresent = await page.evaluate(() => !!window.__LMS_SOCKET);
  console.log('[EVAL] window.__LMS_SOCKET present =', socketPresent);
  out.push('[EVAL] window.__LMS_SOCKET present = ' + socketPresent);

  // Click create button (will be allowed now because we set discordUser and prompt)
  try {
    await page.waitForSelector('#create-lobby-btn', { timeout: 5000 });
    console.log('Clicking create button via evaluate()...');
    await page.evaluate(() => { const b = document.getElementById('create-lobby-btn'); if (b) b.click(); });

    // Wait for navigation to lobby.html (the app redirects on success)
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    console.log('Navigation happened, current URL:', await page.url());
    out.push('Navigation to: ' + await page.url());

    // On lobby page, give socket a moment to connect
    await sleep(1500);

    const ioTypeLobby = await page.evaluate(() => typeof window.io);
    console.log('[EVAL] typeof io (lobby) =', ioTypeLobby);
    out.push('[EVAL] typeof io (lobby) = ' + ioTypeLobby);

    const socketPresentLobby = await page.evaluate(() => !!window.__LMS_SOCKET);
    console.log('[EVAL] window.__LMS_SOCKET present (lobby) =', socketPresentLobby);
    out.push('[EVAL] window.__LMS_SOCKET present (lobby) = ' + socketPresentLobby);

  } catch (err) {
    console.error('Error during create-click/navigation test:', err.message || err);
    out.push('Error during create-click/navigation test: ' + (err.message || err));
  }

  // Save captured logs
  const logPath = 'server/puppeteer-console.log';
  fs.writeFileSync(logPath, out.join('\n'), 'utf8');
  console.log('Saved console log to', logPath);

  await browser.close();
  process.exit(0);
})();
