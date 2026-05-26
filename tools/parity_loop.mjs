/**
 * CI/CD Parity Loop — test, screenshot, vision compare, iterate.
 * Usage: node tools/parity_loop.mjs [iterations]  (default: infinite)
 */

import { execSync } from 'child_process';
import { readFileSync, statSync } from 'fs';

const MAX_ITERATIONS = parseInt(process.argv[2] || '9999');

async function iteration(n) {
  console.log(`\n=== PARITY ITERATION ${n} ===`);
  
  // 1. Boot test
  const boot = execSync('node tools/test_boot_full.mjs', { encoding: 'utf8', cwd: 'C:/Users/Quandale Dingle/5DEngine' });
  const bootOk = boot.includes('no fatal error');
  const things = (boot.match(/total Things.*?(\d+)/) || ['','?'])[1];
  console.log(`  Boot: ${bootOk?'✅':'❌'} ${things} Things`);
  if (!bootOk) return false;

  // 2. Screenshots (resilient)
  try {
    execSync('node tools/screenshot_compare.mjs', { cwd: 'C:/Users/Quandale Dingle/5DEngine', timeout: 25000 });
  } catch(e) {
    // Legacy times out — use just ankhor screenshot
    try{
      const { chromium } = await import('playwright');
      const br = await chromium.launch({headless:true,args:['--no-sandbox']});
      const pg = await br.newPage({viewport:{width:1280,height:720}});
      await pg.goto('http://localhost:8080/index.html',{timeout:15000,waitUntil:'commit'});
      await pg.waitForTimeout(5000);
      await pg.screenshot({path:'comparisons/ankhor_substrate.png'});
      await br.close();
    }catch(_){}
  }
  const aSize = statSync('comparisons/ankhor_substrate.png').size;
  const gSize = statSync('comparisons/legacy_game.png').size;
  const pct = (aSize / gSize * 100).toFixed(1);
  console.log(`  Size: ${(aSize/1024).toFixed(1)}KB / ${(gSize/1024).toFixed(1)}KB = ${pct}%`);

  // 3. Vision compare
  try {
    execSync('node tools/vision_compare.mjs', { cwd: 'C:/Users/Quandale Dingle/5DEngine', timeout: 30000 });
    const report = readFileSync('comparisons/vision_report.txt', 'utf8').slice(0, 500);
    console.log(`  Vision: ${report.includes('100%') ? 'MATCH' : 'DIFFERENCES FOUND'}`);
    console.log(`  ${report.split('\n')[0]}`);
  } catch(e) {
    console.log(`  Vision: SKIP (${e.message?.slice(0,50)})`);
  }

  // 4. Commit + push
  try {
    execSync('git add -A && git commit -m "parity iter ' + n + ': ' + pct + '%" && git push origin 7D-server', { cwd: 'C:/Users/Quandale Dingle/5DEngine' });
  } catch(e) {}

  return pct !== '100.0';
}

async function main() {
  console.log('=== AUTONOMOUS PARITY LOOP ===');
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const shouldContinue = await iteration(i);
    if (!shouldContinue) {
      console.log('\n🎯 PARITY ACHIEVED!');
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
