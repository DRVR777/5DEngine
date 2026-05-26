// Auto-generate barrel imports for all missing facets in src/ankhor/facets/index.js
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const barrelPath = resolve(__dirname, 'index.js');
const existing = readFileSync(barrelPath, 'utf-8');

const allFiles = readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'index.js');
const missing = allFiles.filter(f => !existing.includes(`"${f.replace('.js','')}"`) && !existing.includes(f.replace('.js','')));

console.log('Missing from barrel:', missing.length);
missing.slice(0, 30).forEach(f => console.log(' ', f));
