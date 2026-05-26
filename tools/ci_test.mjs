/**
 * CI test: verifies bullets appear when mouse is clicked.
 * Usage: node tools/ci_test.mjs
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:8080';

async function main() {
  // Check server
  try { await fetch(`${BASE}/index.html`); } catch (e) {
    console.log('FAIL: server not running on 8080');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const failures = [];

  try {
    // Load and wait for boot
    console.log('1. Loading Ankhor substrate...');
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const bootText = await page.evaluate(() => document.getElementById('boot')?.innerText || '');
    if (!bootText.includes('live')) {
      failures.push('Boot failed: ' + bootText);
    } else {
      console.log('   Boot OK: ' + bootText);
    }

    // Count initial bullets
    const initialBullets = await page.evaluate(() => {
      const s = window._scene;
      return s ? s.children.filter(c => (c.name || '').startsWith('bullet/')).length : -1;
    });
    console.log(`2. Initial bullets: ${initialBullets}`);

    // Simulate pointer lock + mouse click
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        // Mock pointer lock
        Object.defineProperty(document, 'pointerLockElement', { value: canvas, configurable: true });
      }
    });
    await page.mouse.click(640, 360); // center of viewport
    await page.waitForTimeout(500);

    // Click several times to fire bullets
    for (let i = 0; i < 5; i++) {
      await page.mouse.down({ button: 'left' });
      await page.waitForTimeout(100);
      await page.mouse.up({ button: 'left' });
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(1000);

    // Count bullets after shooting
    const finalBullets = await page.evaluate(() => {
      const s = window._scene;
      return s ? s.children.filter(c => (c.name || '').startsWith('bullet/')).length : -1;
    });
    console.log(`3. Bullets after shooting: ${finalBullets}`);

    if (finalBullets <= initialBullets && initialBullets >= 0) {
      failures.push(`Bullets did not increase: ${initialBullets} -> ${finalBullets}`);
    }

    // Verify hero exists
    const heroExists = await page.evaluate(() => {
      const s = window._scene;
      return s ? !!s.children.find(c => c.name === 'hero/main') : false;
    });
    console.log(`4. Hero visible: ${heroExists}`);
    if (!heroExists) failures.push('Hero not visible');

  } catch (e) {
    failures.push('Exception: ' + e.message);
  }

  await browser.close();

  if (failures.length) {
    console.log('\n❌ CI FAILED:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('\n✅ CI PASSED');
}

main();
