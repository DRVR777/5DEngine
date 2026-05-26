/**
 * CI/CD Loop — auto test, screenshot, compare on every commit.
 * Usage: node tools/cicd.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, statSync } from 'fs';

const PASS = '✅', FAIL = '❌';

function run(label, cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', timeout: 30000, cwd: 'C:/Users/Quandale Dingle/5DEngine' });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: e.stderr || e.message };
  }
}

console.log('=== CI/CD LOOP ===\n');

// 1. Boot test
console.log('1. Boot test...');
const boot = run('boot', 'node tools/test_boot_full.mjs');
const bootOk = boot.out.includes('no fatal error');
const things = (boot.out.match(/total Things in registry: (\d+)/) || ['','?'])[1];
console.log(`   ${bootOk ? PASS : FAIL} Boot: ${things} Things`);

// 2. Screenshot
console.log('2. Screenshots...');
const ss = run('screenshot', 'node tools/screenshot_compare.mjs');
const ssOk = ss.ok;
console.log(`   ${ssOk ? PASS : FAIL} Screenshots captured`);

// 3. Compare file sizes
try {
  const aSize = statSync('comparisons/ankhor_substrate.png').size;
  const gSize = statSync('comparisons/legacy_game.png').size;
  const pct = ((aSize / gSize) * 100).toFixed(1);
  console.log(`3. ${PASS} Sizes: ankhor=${(aSize/1024).toFixed(1)}KB legacy=${(gSize/1024).toFixed(1)}KB (${pct}%)`);
} catch (e) {
  console.log(`3. ${FAIL} Size comparison failed: ${e.message}`);
}

// 4. Count visible
console.log('4. Object count...');
try {
  const { chromium } = await import('playwright');
  const br = await chromium.launch({ headless: true });
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.goto('http://localhost:8080/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);
  const info = await pg.evaluate(() => {
    const s = window._scene;
    if (!s) return { total: 0 };
    const groups = {};
    for (const c of s.children) {
      const base = (c.name || c.type).split('/')[0].split('-')[0];
      groups[base] = (groups[base] || 0) + 1;
    }
    const top = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { total: s.children.length, top };
  });
  console.log(`   ${PASS} ${info.total} objects in scene`);
  info.top.forEach(([k, v]) => console.log(`      ${k}: ${v}`));
  await br.close();
} catch (e) {
  console.log(`   ${FAIL} ${e.message}`);
}

// 5. Summary
console.log('\n=== CI/CD COMPLETE ===');
console.log(bootOk && ssOk ? `${PASS} ALL GREEN` : `${FAIL} ISSUES DETECTED`);
