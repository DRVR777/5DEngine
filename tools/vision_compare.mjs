/**
 * Vision Compare v4 — uses local Ollama Gemma 4 for real image analysis.
 * Ollama endpoint: http://localhost:11434/api/chat
 */

import { readFileSync, writeFileSync } from 'fs';

async function main() {
  const ankhor = readFileSync('comparisons/ankhor_substrate.png').toString('base64');
  const legacy = readFileSync('comparisons/legacy_game.png').toString('base64');

  console.log('Sending to local Gemma 4...');

  const prompt = `You are comparing two game screenshots. Image 1 is a work-in-progress clone of Image 2.

CRITICAL QUESTIONS — answer each with exact numbers and specifics:

ARE THEY THE SAME? Answer YES or NO first.

HUD DIFFERENCES (exact list):
- What text/numbers/labels are in Image 2 that are NOT in Image 1? List EVERY one.
- What UI panels/menus/overlays are in Image 2 missing from Image 1?
- Position of HP display, ammo counter, minimap, crosshair — list coordinates or positions for BOTH images.

3D OBJECT DIFFERENCES:
- Count ALL visible 3D objects in Image 1: ___
- Count ALL visible 3D objects in Image 2: ___
- What objects exist in Image 2 but NOT Image 1? Name each type.
- Are enemies visible? How many in each image?

EFFECTS DIFFERENCES:
- Shadows? YES/NO for each image
- Muzzle flash? YES/NO
- Particles/sparks? YES/NO, count if visible
- Fog/atmosphere? Describe each
- Screen shake/blur? YES/NO

COLOR DIFFERENCES:
- Dominant sky color in each
- Dominant ground color in each
- Overall saturation: low/medium/high for each
- Are they visually the same scene?`;

  try {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma4:e2b',  // 7.2GB — faster
        messages: [{
          role: 'user',
          content: prompt,
          images: [ankhor, legacy]
        }],
        stream: false
      })
    });

    const data = await res.json();
    const reply = data.message?.content || JSON.stringify(data);
    console.log('=== GEMMA 4 VISION REPORT ===');
    console.log(reply);
    writeFileSync('comparisons/vision_report.txt', reply);
  } catch (e) {
    console.log('Ollama error:', e.message);
    console.log('Try: ollama pull gemma4:e4b');
  }
}

main();
