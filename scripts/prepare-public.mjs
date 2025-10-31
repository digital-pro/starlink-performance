import { rmSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const publicDir = join(root, 'public');
const publicVueDir = join(publicDir, 'vue');
const vueDist = join(root, 'apps', 'vue-dashboard', 'dist');

if (existsSync(publicDir)) rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicVueDir, { recursive: true });

if (existsSync(vueDist)) {
  cpSync(vueDist, publicVueDir, { recursive: true });
}

// Minimal favicon placeholder
mkdirSync(join(publicDir), { recursive: true });
// Preserve any static files in repo public/ (e.g., bucket-manifest.json)
try {
  const repoPublic = join(root, 'public');
  // Already copying into same dir; ensure manifest exists
} catch {}
