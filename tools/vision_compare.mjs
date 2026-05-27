/**
 * Vision Compare v4 — uses local Ollama Gemma 4 for real image analysis.
 * Ollama endpoint: http://localhost:11434/api/chat
 */

import { readFileSync, writeFileSync } from 'fs';

async function main() {
  const ankhor = readFileSync('comparisons/ankhor_substrate.png').toString('base64');
  const legacy = readFileSync('comparisons/legacy_game.png').toString('base64');

  console.log('Sending to local Gemma 4...');

  const prompt = `[SYSTEM: You are a visual comparison engine. I will show you two game screenshots and ask you to list specific differences.]

IMAGE 1: "Ankhor substrate" — a work-in-progress game scene.
IMAGE 2: "Legacy game" — the reference target.

Compare them and answer:
1. LIST every HUD/text element visible in Image 2 that is MISSING from Image 1
2. LIST every 3D object visible in Image 2 that is MISSING from Image 1
3. What visible effects (muzzle flash, particles, shadows, fog) are in Image 2 but not Image 1?
4. What is the dominant color palette difference?
5. How many enemies/barrels/buildings can you count in each?

Be specific. Short answers only.`;

  try {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma4:e4b',
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
