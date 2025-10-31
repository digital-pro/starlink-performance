#!/usr/bin/env node

/**
 * Bootstrap Vercel environment variables after project renames.
 *
 * Loads Grafana and Vercel Blob credentials from local `secrets/` files and
 * upserts them into the specified Vercel project using the Vercel REST API.
 *
 * Usage examples:
 *   node scripts/bootstrap-vercel.mjs --project starlink-performance --team digitalpros-projects
 *   VERCEL_TOKEN=... node scripts/bootstrap-vercel.mjs
 */

import { readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const secretsDir = join(repoRoot, 'secrets');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = new Map();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      result.set(key, next);
      i += 1;
    } else {
      result.set(key, 'true');
    }
  }
  return result;
}

function sanitizeValue(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function parseEnvFile(file) {
  try {
    const raw = await readFile(file, 'utf8');
    const lines = raw.split(/\r?\n/);
    const entries = new Map();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = sanitizeValue(trimmed.slice(eq + 1));
      if (key) entries.set(key, value);
    }
    return entries;
  } catch (error) {
    const reason = error && error.code === 'ENOENT' ? 'not found' : error.message;
    console.warn(`⚠️  Skipping ${basename(file)} (${reason})`);
    return new Map();
  }
}

function buildQuery(baseUrl, teamId) {
  if (!teamId) return baseUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}teamId=${encodeURIComponent(teamId)}`;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} → ${detail || 'no body'}`);
  }
  return res.json();
}

async function ensureEnv({ project, teamId, token, desiredEnv }) {
  if (!project) throw new Error('Missing Vercel project name. Use --project or set VERCEL_PROJECT_NAME.');
  if (!token) throw new Error('Missing Vercel token. Provide --token, set VERCEL_TOKEN, or populate secrets/vercel_token.txt.');

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const projectId = encodeURIComponent(project);
  const envUrl = buildQuery(`https://api.vercel.com/v9/projects/${projectId}/env`, teamId);
  const data = await fetchJson(envUrl, { headers });
  const existingEnvs = Array.isArray(data?.envs) ? data.envs : [];

  const summary = [];

  for (const [key, value] of desiredEnv.entries()) {
    if (!value) continue;
    const match = existingEnvs.find((env) => env.key === key && !env.system);
    const targets = ['production', 'preview', 'development'];
    if (match) {
      const patchUrl = buildQuery(`https://api.vercel.com/v10/projects/${projectId}/env/${match.id}`, teamId);
      await fetchJson(patchUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ value, target: targets, type: 'plain' })
      });
      summary.push(`🔁 Updated ${key}`);
    } else {
      await fetchJson(envUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key, value, target: targets, type: 'plain' })
      });
      summary.push(`➕ Created ${key}`);
    }
  }

  if (summary.length === 0) {
    console.log('ℹ️  No environment variables were created or updated.');
  } else {
    for (const line of summary) console.log(line);
  }
}

async function readToken({ argToken }) {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN.trim();
  if (argToken) return argToken.trim();
  try {
    const fileToken = await readFile(join(secretsDir, 'vercel_token.txt'), 'utf8');
    return sanitizeValue(fileToken);
  } catch {
    return undefined;
  }
}

async function collectDesiredEnv() {
  const grafana = await parseEnvFile(join(secretsDir, 'grafana_env.txt'));
  const blob = await parseEnvFile(join(secretsDir, 'vercel_blob_token.txt'));

  const desired = new Map();

  const grafanaKeys = ['PROM_URL', 'PROM_BASIC', 'PROM_USER', 'PROM_TOKEN', 'PROM_BEARER'];
  for (const key of grafanaKeys) {
    const value = grafana.get(key);
    if (value) desired.set(key, value);
  }

  const blobToken = blob.get('BLOB_READ_WRITE_TOKEN') || blob.get('PERFORMANCE_READ_WRITE_TOKEN');
  if (blobToken) {
    desired.set('BLOB_READ_WRITE_TOKEN', blobToken);
    desired.set('PERFORMANCE_READ_WRITE_TOKEN', blobToken);
  }

  return desired;
}

(async () => {
  try {
    const args = parseArgs();
    const project = args.get('project') || process.env.VERCEL_PROJECT_NAME || 'starlink-performance';
    const teamId = args.get('team') || process.env.VERCEL_TEAM_ID || process.env.VERCEL_SCOPE || 'digitalpros-projects';
    const argToken = args.get('token');
    const token = await readToken({ argToken });

    const desiredEnv = await collectDesiredEnv();
    if (desiredEnv.size === 0) {
      throw new Error('No environment variables found in secrets/. Populate grafana_env.txt and vercel_blob_token.txt first.');
    }

    console.log(`Configuring Vercel project "${project}"${teamId ? ` (team: ${teamId})` : ''}...`);
    await ensureEnv({ project, teamId, token, desiredEnv });
    console.log('✅ Environment variables synchronized. Deploy with `npm run deploy` to apply.');
  } catch (error) {
    console.error(`❌ ${error?.message || error}`);
    process.exitCode = 1;
  }
})();


