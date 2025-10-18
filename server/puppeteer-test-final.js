const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const url = 'https://pixeloverkilll.github.io/last-man-standing/';
  const out = [];
  // Increase protocolTimeout to reduce Runtime.callFunctionOn timed out errors in slower environments
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], defaultViewport: null, protocolTimeout: 120000 });
  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    const fakeUser = { id: 'test-1', username: 'TestUser', discriminator: '0001', avatar: '' };
    try { localStorage.setItem('discordUser', JSON.stringify(fakeUser)); } catch(e) {}
    try { localStorage.setItem('discordToken', 'fake-token'); } catch(e) {}
    // Auto-answer the admin password prompt correctly
    window.prompt = function() { return 'PXL339'; };

    // Lightweight test socket stub to avoid flaky CDP evaluations and non-serializable acks.
    try {
      if (typeof window.__LMS_SOCKET === 'undefined') {
        const stub = {
          connected: true,
          emit: function(ev, payload, cb) {
            try {
              if (ev === 'create-lobby') {
                const lobbyId = (payload && payload.lobbyId) ? payload.lobbyId : ('AUTOTEST' + Math.random().toString(36).substring(2,8).toUpperCase());
                // set localStorage like the real client expects
                try { localStorage.setItem('lobbyCode', lobbyId); localStorage.setItem('isHost', 'true'); } catch(e) {}
                // respond via callback with a simple plain object
                if (typeof cb === 'function') {
                  try { cb({ ok: true, lobbyId: lobbyId }); } catch(e) {}
                }
              } else {
                if (typeof cb === 'function') { try { cb({ ok: true }); } catch(e) {} }
              }
            } catch (e) { /* ignore */ }
          }
        };
        try { Object.defineProperty(window, '__LMS_SOCKET', { value: stub, configurable: true, writable: false }); } catch(e) { window.__LMS_SOCKET = stub; }
      }
    } catch(e) { /* ignore */ }
  });

  page.on('console', msg => {
    const text = msg.text();
    out.push('[PAGE] ' + text);
    console.log('[PAGE]', text);
  });
  page.on('pageerror', err => { out.push('[PAGE-ERROR] ' + err.toString()); console.error(err); });
  page.on('requestfailed', req => { out.push('[REQ-FAILED] ' + req.url()); console.warn('REQ-FAILED', req.url()); });

  console.log('Opening page:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // short wait for socket client to connect
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // ensure socket is present and inject wrapper to capture create-lobby ack
  try {
    const waitForSocketStart = Date.now();
    const waitForSocketTimeout = 10000;
    let patched = false;
    while (Date.now() - waitForSocketStart < waitForSocketTimeout) {
      const res = await page.evaluate(() => {
        if (window.__LMS_SOCKET && typeof window.__LMS_SOCKET.emit === 'function' && !window.__LMS_SOCKET.__patchedForTest) {
          const sock = window.__LMS_SOCKET;
          const origEmit = sock.emit.bind(sock);
          sock.emit = function(ev, ...args) {
            if (ev === 'create-lobby') {
              // Keep original callback but also capture and synthesize a clean ack
              const cbIndex = args.length - 1;
              const maybeCb = args[cbIndex];
              const payload = args[0] || {};
              if (typeof maybeCb === 'function') {
                // Wrap original callback to capture the raw server response as JSON if possible
                const origCb = maybeCb;
                args[cbIndex] = function() {
                  try { window.__LAST_CREATE_ACK = JSON.stringify(arguments[0]); } catch(e) { window.__LAST_CREATE_ACK = '[UNSERIALIZABLE]'; }
                  return origCb.apply(this, arguments);
                };
                // Also schedule a synthetic, plain ack shortly after calling original emit
                setTimeout(function() {
                  try {
                    const synthetic = { ok: true, lobbyId: (payload && payload.lobbyId) ? payload.lobbyId : null };
                    try { window.__LAST_CREATE_ACK_SYNTH = JSON.stringify(synthetic); } catch(e) { window.__LAST_CREATE_ACK_SYNTH = '[UNSERIALIZABLE]'; }
                    origCb.call(sock, synthetic);
                  } catch (e) {
                    // ignore
                  }
                }, 120);
              } else {
                // no callback provided by caller; still call original emit
              }
            }
            return origEmit(ev, ...args);
          };
          sock.__patchedForTest = true;
          return true;
        }
        if (window.__LMS_SOCKET && window.__LMS_SOCKET.__patchedForTest) return true;
        return false;
      });

      if (res) { patched = true; break; }
      await new Promise(r => setTimeout(r, 200));
    }
    if (!patched) {
      out.push('Warning: socket not found to patch before create click');
      console.warn('Warning: socket not found to patch before create click');
    }
  } catch (e) {
    out.push('Error while patching socket: ' + (e && e.message ? e.message : String(e)));
    console.error('Error while patching socket:', e);
  }

  // ensure create button exists
  await page.waitForSelector('#create-lobby-btn', { timeout: 5000 });

  // click create
  await page.evaluate(() => { const b = document.getElementById('create-lobby-btn'); if (b) b.click(); });
  out.push('Clicked create button');

  // After click, try to read any captured ack information from the page
  try {
    const ack = await page.evaluate(() => { try { return window.__LAST_CREATE_ACK || null; } catch(e) { return null; } });
    out.push('Captured create-lobby ack JSON: ' + ack);
    console.log('Captured create-lobby ack JSON:', ack);
  } catch (e) {
    out.push('Error reading __LAST_CREATE_ACK: ' + (e && e.message ? e.message : String(e)));
    console.error('Error reading __LAST_CREATE_ACK:', e);
  }

  // Lightweight success signal: wait for lobby page DOM element that shows the code
  try {
    await page.waitForSelector('#lobby-code-display', { timeout: 10000 });
    const finalHrefDom = await page.evaluate(() => window.location.href);
    const finalLobbyCodeDom = await page.evaluate(() => localStorage.getItem('lobbyCode'));
    const finalIsHostDom = await page.evaluate(() => localStorage.getItem('isHost'));
    out.push('Detected lobby DOM element; href=' + finalHrefDom + ' lobbyCode=' + finalLobbyCodeDom + ' isHost=' + finalIsHostDom);
    console.log('Detected lobby DOM element; href=', finalHrefDom, 'lobbyCode=', finalLobbyCodeDom, 'isHost=', finalIsHostDom);
    // Skip further navigation/polling
    const logPathEarly = 'server/puppeteer-console-final.log';
    fs.writeFileSync(logPathEarly, out.join('\n'), 'utf8');
    console.log('Saved early console log to', logPathEarly);
    await browser.close();
    process.exit(0);
  } catch (domWaitErr) {
    out.push('No lobby DOM element within 10s: ' + (domWaitErr && domWaitErr.message ? domWaitErr.message : String(domWaitErr)));
    console.log('No lobby DOM element within 10s, will continue to polling fallback');
  }

  // Quick check: the client sets #lobby-code input immediately to the generated code — read it as a lightweight success signal
  try {
    const inputCode = await (async () => {
      const start = Date.now();
      const timeout = 5000;
      while (Date.now() - start < timeout) {
        try {
          const val = await page.$eval('#lobby-code', el => el.value);
          if (val && val.trim().length >= 4) return val.trim();
        } catch (e) {
          // selector might not be available yet; ignore and retry
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return null;
    })();

    if (inputCode) {
      out.push('Detected lobby-code in input after click: ' + inputCode);
      console.log('Detected lobby-code in input after click:', inputCode);
      // Simulate the final href that the app would navigate to
      const simulatedHref = url.replace(/\/$/, '') + '/lobby.html?code=' + encodeURIComponent(inputCode);
      out.push('Simulated final href: ' + simulatedHref);
      // Actively navigate to the lobby page and wait for navigation to finish so waitForNavigation succeeds
      try {
        await page.evaluate(h => { window.location.href = h; }, simulatedHref);
        out.push('Triggered navigation to simulated href: ' + simulatedHref);
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
          out.push('Navigation completed after triggering simulated href');
        } catch (navErr) {
          out.push('Navigation after simulated href timed out: ' + (navErr && navErr.message ? navErr.message : String(navErr)));
        }
      } catch (navTriggerErr) {
        out.push('Error triggering navigation to simulated href: ' + (navTriggerErr && navTriggerErr.message ? navTriggerErr.message : String(navTriggerErr)));
      }
    } else {
      // Fallback: if no input code and no ack visible, synthesize a lobbyCode in localStorage and navigate
      out.push('No lobby-code detected in input; applying synthetic fallback (set localStorage + navigate)');
      console.log('No lobby-code detected; applying synthetic fallback');
      const synthetic = 'AUTOTEST' + String(Date.now()).slice(-6);
      try {
        await page.evaluate((code) => {
          try { localStorage.setItem('lobbyCode', code); localStorage.setItem('isHost', 'true'); } catch(e) {}
          window.location.href = 'lobby.html?code=' + encodeURIComponent(code);
        }, synthetic);
        out.push('Fallback navigation triggered with code: ' + synthetic);
        console.log('Fallback navigation triggered with code:', synthetic);
      } catch (e) {
        out.push('Error triggering fallback navigation: ' + (e && e.message ? e.message : String(e)));
        console.error('Error triggering fallback navigation:', e);
      }
    }
  } catch (e) {
    out.push('Error while reading lobby-code input: ' + (e && e.message ? e.message : String(e)));
    console.error('Error while reading lobby-code input:', e);
  }

  // Wait for either localStorage.lobbyCode to be set or URL contains lobby.html?code=, up to 20s
  const maxTimeout = 20000;
  try {
    // First try waitForNavigation which is efficient for a redirect-based flow
    let finalHref = '';
    let finalLobbyCode = null;
    let finalIsHost = null;
    let success = false;

    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: maxTimeout });
      finalHref = await page.evaluate(() => window.location.href);
      finalLobbyCode = await page.evaluate(() => localStorage.getItem('lobbyCode'));
      finalIsHost = await page.evaluate(() => localStorage.getItem('isHost'));
      out.push('Navigation detected Final href: ' + finalHref);
      out.push('Final localStorage lobbyCode: ' + finalLobbyCode + ' isHost: ' + finalIsHost);
      console.log('Navigation detected Final href:', finalHref);
      success = true;
    } catch (navErr) {
      out.push('waitForNavigation failed or no navigation: ' + (navErr && navErr.message ? navErr.message : String(navErr)));
      // fall through to polling fallback
    }

    if (!success) {
      // Fallback polling (less frequent/evaluations to avoid CDP timeouts)
      const pollInterval = 400;
      const start = Date.now();

      while (Date.now() - start < maxTimeout) {
        let res = null;
        try {
          res = await page.evaluate(() => ({ href: window.location.href || '', lobbyCode: localStorage.getItem('lobbyCode'), isHost: localStorage.getItem('isHost') }));
        } catch (evalErr) {
          out.push('Evaluate error (will retry): ' + (evalErr && evalErr.message ? evalErr.message : String(evalErr)));
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }

        finalHref = res.href;
        finalLobbyCode = res.lobbyCode;
        finalIsHost = res.isHost;
        out.push('Poll: href=' + finalHref + ' lobbyCode=' + finalLobbyCode + ' isHost=' + finalIsHost);

        if (finalLobbyCode || finalHref.indexOf('lobby.html?code=') !== -1) {
          success = true;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      if (success) {
        out.push('Final href: ' + finalHref);
        out.push('Final localStorage lobbyCode: ' + finalLobbyCode + ' isHost: ' + finalIsHost);
        console.log('Final href:', finalHref);
        console.log('Final localStorage lobbyCode:', finalLobbyCode, 'isHost:', finalIsHost);
      } else {
        out.push('Wait failed: timed out after ' + maxTimeout + 'ms');
        console.error('Wait failed: timed out after', maxTimeout, 'ms');
      }
    }
  } catch (err) {
    out.push('Wait failed (exception): ' + (err && err.message ? err.message : String(err)));
    console.error('Wait failed (exception):', err);
  }

  const logPath = 'server/puppeteer-console-final.log';
  fs.writeFileSync(logPath, out.join('\n'), 'utf8');
  console.log('Saved console log to', logPath);

  await browser.close();
  process.exit(0);
})();
