import { rmSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const publicDir = join(root, 'public');
const vueDist = join(root, 'apps', 'vue-dashboard', 'dist');

if (existsSync(publicDir)) rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });

if (existsSync(vueDist)) {
  cpSync(vueDist, publicDir, { recursive: true });
}

// Minimal favicon placeholder
mkdirSync(join(publicDir), { recursive: true });
