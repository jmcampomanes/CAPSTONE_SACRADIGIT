import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

function findHtmlFiles(dir, base = dir) {
  let results = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      results = { ...results, ...findHtmlFiles(fullPath, base) };
    } else if (entry.name.endsWith('.html')) {
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