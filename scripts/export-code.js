#!/usr/bin/env node
/*
 Export all source code into a single text file (codebase.txt),
 excluding heavy or ephemeral folders.

 Excludes: .git, node_modules, .venv, venv, logs, reports, screenshots, playwright caches.
*/
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'codebase.txt');

const EXCLUDE_DIRS = new Set([
  '.git', 'node_modules', '.venv', 'venv', 'logs', 'reports', 'screenshots',
  'playwright-report', '.playwright-cache', 'test-results', '.whatsapp-session-qa'
]);

const EXCLUDE_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', '.DS_Store', 'Thumbs.db'
]);

const TEXT_EXTS = new Set([
  // code
  '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.yml', '.yaml', '.gitignore', '.npmrc', '.env.example', '.txt',
  '.feature', '.css', '.scss', '.html', '.config', '.tsconfig', '.eslintrc', '.prettierrc'
]);

function isExcludedDir(name) { return EXCLUDE_DIRS.has(name); }
function isExcludedFile(name) { return EXCLUDE_FILES.has(name); }
function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return true; // allow extensionless text files
  return TEXT_EXTS.has(ext);
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith('.git')) continue;
    if (ent.isDirectory()) {
      if (isExcludedDir(ent.name)) continue;
      walk(path.join(dir, ent.name), out);
    } else if (ent.isFile()) {
      if (isExcludedFile(ent.name)) continue;
      const fp = path.join(dir, ent.name);
      try {
        if (!isTextFile(fp)) continue; // skip binaries and large assets by extension
        const rel = path.relative(ROOT, fp);
        const data = fs.readFileSync(fp, 'utf8');
        out.push(`\n===== FILE: ${rel} =====\n`);
        out.push(data);
      } catch (e) {
        // ignore unreadables
      }
    }
  }
}

function main() {
  const chunks = [];
  walk(ROOT, chunks);
  fs.writeFileSync(OUTPUT, chunks.join('\n'));
  console.log(`✅ Export completado: ${OUTPUT}`);
}

if (require.main === module) main();
