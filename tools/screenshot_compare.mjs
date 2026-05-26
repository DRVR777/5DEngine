/**
 * Visual comparison — screenshots index.html (Ankhor substrate) vs game.html (legacy).
 * One image each. No video. Saves to comparisons/ folder.
 * Usage: node tools/screenshot_compare.mjs
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';

const PORT = 8080;
const BASE = `http://localhost:${PORT}`;

async function main() {
  // Start server if not running
  let server;
  try {
    await fetch(`${BASE}/index.html`);
  } catch {
    console.log('Starting server...');
    server = execSync('start /B node game_server.js 8080', { cwd: process.cwd(), stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 2000));
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  // --- Ankhor substrate ---
  console.log('Opening index.html (Ankhor substrate)...');
  const pageA = await context.newPage();
  await pageA.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 20000 });
  await pageA.waitForTimeout(2000); // let first frame render
  await pageA.screenshot({ path: 'comparisons/ankhor_substrate.png', fullPage: false });
  console.log('  → comparisons/ankhor_substrate.png');

  // --- Legacy game ---
  console.log('Opening game.html (legacy game)...');
  const pageG = await context.newPage();
  await pageG.goto(`${BASE}/game.html`, { waitUntil: 'load', timeout: 20000 });
  await pageG.waitForTimeout(2000);
  await pageG.screenshot({ path: 'comparisons/legacy_game.png', fullPage: false });
  console.log('  → comparisons/legacy_game.png');

  await browser.close();
  console.log('Done. Compare images in comparisons/ folder.');
}

main().catch(e => { console.error(e); process.exit(1); });
