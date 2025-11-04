import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, '../dist');
const dest = path.join(__dirname, '../../server/public');

if (!fs.existsSync(src)) {
  console.error('❌ Error: dist folder not found. Run "npm run build" first.');
  process.exit(1);
}

// Remove existing public folder if it exists
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}

// Copy dist to server/public
fs.cpSync(src, dest, { recursive: true });

console.log('✅ Successfully copied dist to server/public');

