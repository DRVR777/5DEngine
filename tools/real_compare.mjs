/**
 * REAL Parity Compare — uses Playwright JS injection to count scene objects, not file sizes.
 * Counts: scene children, HUD elements, entity types.
 */

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, statSync } from 'fs';

async function inspectPage(url, label) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  let result = { error: null, scene: {}, hud: {}, entities: {} };
  
  try {
    await page.goto(url, { timeout: 20000, waitUntil: 'commit' });
    await page.waitForTimeout(5000);
    
    result = await page.evaluate(() => {
      const s = window._scene;
      const data = { scene: { totalChildren: s?.children?.length || 0 }, hud: {}, entities: {} };
      
      // Count scene children by type
      if (s?.children) {
        const types = {};
        for (const c of s.children) {
          const name = (c.name || c.type || '').split('/')[0];
          types[name] = (types[name] || 0) + 1;
        }
        data.entities = types;
      }
      
      // Check HUD elements
      const hudIds = ['hp', 'ammo', 'kills', 'weapon', 'sprint', 'crosshair', 'muzzle', 'reload', 'minimap', 'combo', 'modeSwitch'];
      for (const id of hudIds) {
        const el = document.getElementById(id);
        data.hud[id] = el ? (el.style?.display !== 'none' && el.offsetParent !== null) : false;
      }
      
      // Check boot status
      const boot = document.getElementById('boot')?.innerText || '';
      data.boot = boot;
      
      return data;
    });
    
    await page.screenshot({ path: `comparisons/${label}.png` });
    
  } catch (e) {
    result.error = e.message?.slice(0, 100);
  }
  
  await browser.close();
  return result;
}

async function main() {
  console.log('=== REAL PARITY COMPARE ===\n');
  
  // Inspect Ankhor
  console.log('Inspecting ankhor...');
  const ankhor = await inspectPage('http://localhost:8080/index.html', 'ankhor_substrate');
  
  // Inspect Legacy
  console.log('Inspecting legacy...');
  const legacy = await inspectPage('http://localhost:8080/game.html', 'legacy_game');
  
  // Report
  console.log('\n--- ANKHOR ---');
  console.log('Boot:', ankhor.boot || ankhor.error);
  console.log('Scene children:', ankhor.scene.totalChildren);
  console.log('Entities:', JSON.stringify(ankhor.entities).slice(0, 500));
  console.log('HUD:', JSON.stringify(ankhor.hud));
  
  console.log('\n--- LEGACY ---');
  console.log('Boot:', legacy.boot || legacy.error);
  console.log('Scene children:', legacy.scene.totalChildren);
  console.log('Entities:', JSON.stringify(legacy.entities).slice(0, 500));
  console.log('HUD:', JSON.stringify(legacy.hud));
  
  // Missing HUD elements
  const missingHud = Object.entries(legacy.hud).filter(([k,v]) => v && !ankhor.hud[k]);
  const extraHud = Object.entries(ankhor.hud).filter(([k,v]) => v && !legacy.hud[k]);
  
  console.log('\n--- DIFF ---');
  console.log('HUD missing from Ankhor:', missingHud.map(([k])=>k).join(', ') || 'none');
  console.log('HUD extra in Ankhor:', extraHud.map(([k])=>k).join(', ') || 'none');
  
  // Entity diffs
  const allEntityTypes = new Set([...Object.keys(ankhor.entities), ...Object.keys(legacy.entities)]);
  console.log('\nEntity comparison:');
  for (const type of [...allEntityTypes].sort()) {
    const a = ankhor.entities[type] || 0;
    const l = legacy.entities[type] || 0;
    if (a !== l) console.log(`  ${type}: ankhor=${a} legacy=${l}`);
  }
  
  // Save report
  const report = {
    ankhor: { entities: ankhor.entities, hud: ankhor.hud, children: ankhor.scene.totalChildren },
    legacy: { entities: legacy.entities, hud: legacy.hud, children: legacy.scene.totalChildren },
    missingHud: missingHud.map(([k])=>k),
    extraHud: extraHud.map(([k])=>k)
  };
  writeFileSync('comparisons/parity_report.json', JSON.stringify(report, null, 2));
  console.log('\nReport saved to comparisons/parity_report.json');
}

main().catch(e => { console.error(e); process.exit(1); });
