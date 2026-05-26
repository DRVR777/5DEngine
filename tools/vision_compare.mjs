/**
 * Vision Compare v2 — sends Ankhor + legacy screenshots to Deepseek API.
 * Reads API key from ~/.pi/agent/auth.json
 * Uses extremely detailed prompt for precise comparison.
 */

import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const AUTH_PATH = join(homedir(), '.pi/agent/auth.json');
let API_KEY = '';

try {
  const auth = JSON.parse(readFileSync(AUTH_PATH, 'utf8'));
  API_KEY = auth.deepseek?.key || '';
} catch (_) {}

const API_URL = 'https://api.deepseek.com/v1/chat/completions';

const SYSTEM_PROMPT = `You are a computer vision comparison engine specializing in 3D game scene analysis.

You will receive TWO screenshots of the same game:
- IMAGE 1: "Ankhor substrate" — a work-in-progress rebuild
- IMAGE 2: "Legacy game" — the reference/target

Your task: catalog EVERY difference between them with extreme precision.

For each image, separately list:
1. HUD ELEMENTS: crosshair type, HP display, ammo counter, kill counter, minimap, weapon name, damage numbers, combo multiplier, reload indicator, mode switch button
2. 3D ENTITIES: count of visible heroes, enemies, barrels, crates, pickups, vehicles, NPCs
3. WORLD: ground color/texture, sky color/gradient, fog density, arena walls, grid lines, lighting shadows
4. EFFECTS: muzzle flash, bullet trails, explosions, blood/oil decals, particles, screen shake, hitmarkers
5. COLORS: describe the dominant palette for each image
6. CAMERA: angle, distance, field of view

Then provide a DIFF section listing what Image 1 is MISSING that Image 2 has.

Output format:
---
ANKHOR (Image 1):
[HUD] ...
[3D] ...
[WORLD] ...
[EFFECTS] ...
[COLORS] ...
[CAMERA] ...

LEGACY (Image 2):
[HUD] ...
[3D] ...
[WORLD] ...
[EFFECTS] ...
[COLORS] ...
[CAMERA] ...

DIFF (missing from Ankhor):
- item 1
- item 2
...

Be extremely specific. Count everything. Name everything visible.`;

async function main() {
  if (!API_KEY) { fallbackCompare(); return; }

  const ankhorB64 = readFileSync('comparisons/ankhor_substrate.png').toString('base64');
  const legacyB64 = readFileSync('comparisons/legacy_game.png').toString('base64');

  console.log('Sending to Deepseek API...');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: [
            { type: 'text', text: 'Compare these two game screenshots.IMAGE 1 is the Ankhor substrate.Work in progress.IMAGE 2 is the legacy game.Reference target.Analyze ALL differences.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${ankhorB64}` } },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${legacyB64}` } }
          ]}
        ],
        max_tokens: 3000,
        temperature: 0.1
      })
    });

    const data = await res.json();

    if (data.error) {
      console.log('API error:', data.error.message);
      fallbackCompare();
      return;
    }

    const reply = data.choices?.[0]?.message?.content || 'No response';
    console.log('=== DEEPSEEK VISION REPORT ===');
    console.log(reply);
    writeFileSync('comparisons/vision_report.txt', reply);
    return reply;

  } catch (e) {
    console.log('Network error:', e.message);
    fallbackCompare();
  }
}

function fallbackCompare() {
  const a = readFileSync('comparisons/ankhor_substrate.png');
  const g = readFileSync('comparisons/legacy_game.png');
  const pct = (a.length / g.length * 100).toFixed(1);
  const report = `=== SIZE COMPARISON ONLY ===
Ankhor: ${(a.length/1024).toFixed(1)}KB
Legacy: ${(g.length/1024).toFixed(1)}KB
Match: ${pct}%
Target: 100%
Images available at: comparisons/ankhor_substrate.png and comparisons/legacy_game.png`;
  console.log(report);
  writeFileSync('comparisons/vision_report.txt', report);
}

main().catch(e => { console.error(e); process.exit(1); });
