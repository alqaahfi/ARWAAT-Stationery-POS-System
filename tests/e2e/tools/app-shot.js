// Screenshots of the APP windows only (taken through the debug connection, so they work even when minimised or hidden).
// usage: node tests/e2e/tools/app-shot.js [label]
const path = require('path');
const { chromium } = require('@playwright/test');
(async () => {
  const label = process.argv[2] || 'now';
  const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
  let n = 0;
  for (const ctx of b.contexts()) for (const p of ctx.pages()) {
    const mode = await p.evaluate(() => window.api && window.api.app && window.api.app.mode).catch(() => null);
    if (!mode) continue;
    const f = path.join(__dirname, '..', '..', '..', 'test-results', 'screenshots', `APP-${label}-${mode}.png`);
    await p.screenshot({ path: f }); console.log(mode, '->', f);
    console.log('   ', (await p.evaluate(() => document.body.innerText)).split('\n').filter(Boolean).slice(0, 40).join(' | ').slice(0, 600));
    n++;
  }
  if (!n) console.log('no app window found');
  process.exit(0);
})().catch((e) => { console.log('cannot attach:', e.message.split('\n')[0]); process.exit(1); });
