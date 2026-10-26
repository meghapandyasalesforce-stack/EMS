import { build } from 'esbuild';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const output = '.react-render-check.cjs';
try {
  await build({
    stdin: { contents: `
      import React from 'react';
      import { renderToString } from 'react-dom/server';
      import App from './src/App.jsx';
      const markup = renderToString(<App />);
      if (!markup.includes('Ananya Deshmukh')) throw new Error('Initial candidate missing');
      if (!markup.includes('Showing 1-6 of 14 New Hires')) throw new Error('Initial pagination incorrect');
      if ((markup.match(/aria-label="Select /g) || []).length !== 6) throw new Error('Expected six candidate rows');
      if (markup.includes('onclick=')) throw new Error('Legacy inline event handlers remain');
      console.log('React server render passed: page, six candidate rows, pagination, and React event markup.');
    `, resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', outfile: output,
  });
  createRequire(import.meta.url)('./' + output);
} finally {
  if (fs.existsSync(output)) fs.unlinkSync(output);
}
