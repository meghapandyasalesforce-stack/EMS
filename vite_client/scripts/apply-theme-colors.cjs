/**
 * One-off batch: replace common Tailwind blue/green/indigo with theme utilities.
 * Run: node scripts/apply-theme-colors.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') walk(p, out);
    else if (e.isFile() && e.name.endsWith('.jsx') && !p.includes('__tests__')) out.push(p);
  }
  return out;
}

const reps = [
  [/bg-blue-600\b/g, 'bg-theme-primary'],
  [/hover:bg-blue-700\b/g, 'hover:opacity-90'],
  [/bg-blue-500\b/g, 'bg-theme-secondary'],
  [/hover:bg-blue-600\b/g, 'hover:opacity-90'],
  [/text-blue-600\b/g, 'text-theme-secondary'],
  [/text-blue-700\b/g, 'text-theme-secondary'],
  [/text-blue-800\b/g, 'text-theme-secondary'],
  [/text-blue-500\b/g, 'text-theme-secondary'],
  [/border-blue-600\b/g, 'border-theme-secondary'],
  [/border-blue-500\b/g, 'border-theme-secondary'],
  [/border-blue-200\b/g, 'border-theme-secondary'],
  [/bg-blue-50\b/g, 'bg-theme-secondary/10'],
  [/bg-blue-100\b/g, 'bg-theme-secondary/10'],
  [/focus:ring-blue-500\b/g, 'focus:ring-2 focus:ring-[var(--color-primary)]'],
  [/focus:border-blue-500\b/g, 'focus:border-[var(--color-primary)]'],
  [/bg-green-600\b/g, 'bg-theme-primary'],
  [/hover:bg-green-700\b/g, 'hover:opacity-90'],
  [/bg-green-500\b/g, 'bg-theme-primary'],
  [/hover:bg-green-600\b/g, 'hover:opacity-90'],
  [/hover:bg-green-800\b/g, 'hover:opacity-90'],
  [/text-green-600\b/g, 'text-theme-primary'],
  [/text-green-700\b/g, 'text-theme-primary'],
  [/text-green-800\b/g, 'text-theme-primary'],
  [/border-green-200\b/g, 'border-theme-primary'],
  [/border-green-500\b/g, 'border-theme-primary'],
  [/bg-green-50\b/g, 'bg-theme-primary/10'],
  [/bg-green-100\b/g, 'bg-theme-primary/10'],
  [/bg-indigo-600\b/g, 'bg-theme-accent'],
  [/bg-indigo-500\b/g, 'bg-theme-accent'],
  [/text-indigo-600\b/g, 'text-theme-accent'],
  [/text-indigo-700\b/g, 'text-theme-accent'],
  [/text-indigo-800\b/g, 'text-theme-accent'],
  [/border-indigo-200\b/g, 'border-theme-accent'],
  [/from-blue-100\b/g, 'from-[var(--color-secondary)]'],
  [/to-blue-100\b/g, 'to-[var(--color-secondary)]'],
  [/from-green-100\b/g, 'from-[var(--color-primary)]'],
  [/to-green-100\b/g, 'to-[var(--color-primary)]'],
  [/from-blue-50\b/g, 'from-white'],
  [/to-blue-50\b/g, 'to-theme-secondary/10'],
  [/from-green-50\b/g, 'from-white'],
  [/to-green-50\b/g, 'to-theme-primary/10'],
  [/from-blue-400\b/g, 'from-[var(--color-secondary)]'],
  [/to-blue-600\b/g, 'to-[var(--color-secondary)]'],
  [/from-green-400\b/g, 'from-[var(--color-primary)]'],
  [/to-green-600\b/g, 'to-[var(--color-primary)]'],
  [/bg-blue-400\b/g, 'bg-theme-secondary'],
  [/text-blue-400\b/g, 'text-theme-secondary'],
  [/border-b-2 border-blue-500\b/g, 'border-b-2 border-theme-secondary'],
  [/ring-blue-500\b/g, 'ring-[var(--color-primary)]'],
  [/focus:ring-2 focus:ring-2 focus:ring-\[var\(--color-primary\)\]/g, 'focus:ring-2 focus:ring-[var(--color-primary)]'],
  [/text-blue-300\b/g, 'text-theme-secondary'],
  [/text-blue-900\b/g, 'text-[var(--color-text)]'],
  [/bg-blue-300\b/g, 'bg-theme-secondary/30'],
  [/border-blue-300\b/g, 'border-theme-secondary'],
  [/text-emerald-600\b/g, 'text-theme-primary'],
  [/text-emerald-800\b/g, 'text-theme-primary'],
  [/bg-emerald-50\b/g, 'bg-theme-primary/10'],
  [/border-emerald-200\b/g, 'border-theme-primary'],
  [/from-emerald-50\b/g, 'from-white'],
  [/to-emerald-50\b/g, 'to-theme-primary/10'],
  [/from-cyan-50\b/g, 'from-white'],
  [/to-cyan-50\b/g, 'to-theme-secondary/10'],
  [/text-cyan-600\b/g, 'text-theme-secondary'],
  [/bg-cyan-100\b/g, 'bg-theme-secondary/10'],
  [/text-cyan-800\b/g, 'text-theme-secondary'],
  [/border-cyan-200\b/g, 'border-theme-secondary'],
];

let count = 0;
for (const f of walk(root)) {
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  for (const [re, to] of reps) s = s.replace(re, to);
  if (s !== orig) {
    fs.writeFileSync(f, s);
    count++;
  }
}
console.log('Updated', count, 'jsx files');
