/**
 * Vision Compare — sends Ankhor + legacy screenshots to Deepseek API for detailed comparison.
 * Usage: node tools/vision_compare.mjs
 * Requires: DEEPSEEK_API_KEY in environment or .env file
 */

import { readFileSync, writeFileSync } from 'fs';

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

async function main() {
  if (!API_KEY) {
    console.log('SKIP: No DEEPSEEK_API_KEY set');
    return fallbackCompare();
  }

  const ankhor = readFileSync('comparisons/ankhor_substrate.png').toString('base64');
  const legacy = readFileSync('comparisons/legacy_game.png').toString('base64');

  const prompt = `You are a visual comparison engine. Analyze these two game screenshots and list EVERY visible difference between them.

IMAGE 1 (ankhor_substrate): A 3D game scene showing an arena with hero, enemies, barrels, crates, ground, and sky.
IMAGE 2 (legacy_game): The reference game scene.

For EACH difference, specify:
1. What object/effect is MISSING from Image 1 that exists in Image 2
2. What object/effect is DIFFERENT (wrong color, size, position, shape)
3. What UI/HUD element is different
4. Count of visible entities (enemies, barrels, pickups, particles)
5. Overall visual quality comparison (lighting, shadows, fog, sky)

Be extremely specific and detailed. List every difference you can detect.`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${ankhor}` } },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${legacy}` } }
          ]
        }],
        max_tokens: 2000,
        temperature: 0.1
      })
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'No response';
    console.log('=== DEEPSEEK VISION COMPARISON ===');
    console.log(reply);
    writeFileSync('comparisons/vision_report.txt', reply);
    return reply;
  } catch (e) {
    console.log('Vision API error:', e.message);
    return fallbackCompare();
  }
}

function fallbackCompare() {
  const a = readFileSync('comparisons/ankhor_substrate.png');
  const g = readFileSync('comparisons/legacy_game.png');
  const pct = (a.length / g.length * 100).toFixed(1);
  const report = `[Size comparison only — no API key]
Ankhor: ${(a.length/1024).toFixed(1)}KB
Legacy: ${(g.length/1024).toFixed(1)}KB
Match: ${pct}%
Target: 100%`;
  console.log(report);
  writeFileSync('comparisons/vision_report.txt', report);
  return report;
}

main().catch(e => { console.error(e); process.exit(1); });
