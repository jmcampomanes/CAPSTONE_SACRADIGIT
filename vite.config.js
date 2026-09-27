import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Dev-only pages: still open under `vite` (dev server), never deployed.
// The seed pages write fake records into the real database.
const DEV_ONLY = [/^seed-mock/];

function findHtmlFiles(dir, base = dir) {
  let results = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'public') continue;
      results = { ...results, ...findHtmlFiles(fullPath, base) };
    } else if (entry.name.endsWith('.html') && !DEV_ONLY.some(re => re.test(entry.name))) {
      const relative = fullPath.slice(base.length + 1).replace(/\.html$/, '');
      const key = relative.replace(/[\\/]/g, '-') || 'index';
      results[key] = fullPath;
    }
  }
  return results;
}

const root = resolve(__dirname);

export default defineConfig({
  base: '/CAPSTONE_SACRADIGIT/',
  build: {
    rollupOptions: {
      input: findHtmlFiles(root),
    },
  },
});