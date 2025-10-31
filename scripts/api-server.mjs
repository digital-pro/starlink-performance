#!/usr/bin/env node
import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const PORT = process.env.PORT || 3000;

function loadEnv() {
  try {
    const envFile = join(ROOT_DIR, '.env.local');
    const content = readFileSync(envFile, 'utf-8');
    const env = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) env[match[1].trim()] = match[2].trim();
    }
    return env;
  } catch (e) { return {}; }
}

const env = { ...process.env, ...loadEnv() };
const PROM_URL = env.PROM_URL || 'http://localhost:9090/api/v1';

console.log(`🚀 Local API server starting on port ${PORT}`);
console.log(`📊 Prometheus URL: ${PROM_URL}\n`);

async function handleAiCorrelate(req, res) {
  try {
    const handlerPath = join(ROOT_DIR, 'api', 'ai-correlate.js');
    const handlerUrl = pathToFileURL(handlerPath).href;
    const handlerModule = await import(handlerUrl);
    const handler = handlerModule.default || handlerModule;
    
    const mockReq = { url: req.url, method: req.method, headers: req.headers };
    let sent = false;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (!sent) {
            res.writeHead(code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            sent = true;
          }
        }
      }),
      writeHead: (code, headers) => {
        if (!sent) {
          Object.entries(headers || {}).forEach(([k, v]) => res.setHeader(k, v));
          res.writeHead(code);
          sent = true;
        }
      },
      end: (data) => { if (!sent) { res.end(data); sent = true; } },
      setHeader: (name, value) => res.setHeader(name, value)
    };
    
    await handler(mockReq, mockRes);
  } catch (error) {
    console.error('Error in ai-correlate:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }
}

async function handlePromql(req, res) {
  try {
    const handlerPath = join(ROOT_DIR, 'api', 'promql.js');
    const handlerUrl = pathToFileURL(handlerPath).href;
    const handlerModule = await import(handlerUrl);
    const handler = handlerModule.default || handlerModule;
    
    const mockReq = { url: req.url, method: req.method, headers: req.headers };
    let sent = false;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (!sent) {
            res.writeHead(code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            sent = true;
          }
        }
      }),
      writeHead: (code, headers) => {
        if (!sent) {
          Object.entries(headers || {}).forEach(([k, v]) => res.setHeader(k, v));
          res.writeHead(code);
          sent = true;
        }
      },
      end: (data) => { if (!sent) { res.end(data); sent = true; } },
      setHeader: (name, value) => res.setHeader(name, value)
    };
    
    await handler(mockReq, mockRes);
  } catch (error) {
    console.error('Error in promql:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }
}

async function handleBenchRuns(req, res) {
  try {
    const handlerPath = join(ROOT_DIR, 'api', 'bench-runs.js');
    const handlerUrl = pathToFileURL(handlerPath).href;
    const handlerModule = await import(handlerUrl);
    const handler = handlerModule.default || handlerModule;
    
    const mockReq = { url: req.url, method: req.method, headers: req.headers };
    let sent = false;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (!sent) {
            res.writeHead(code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            sent = true;
          }
        }
      }),
      writeHead: (code, headers) => {
        if (!sent) {
          Object.entries(headers || {}).forEach(([k, v]) => res.setHeader(k, v));
          res.writeHead(code);
          sent = true;
        }
      },
      end: (data) => { if (!sent) { res.end(data); sent = true; } },
      setHeader: (name, value) => res.setHeader(name, value)
    };
    
    await handler(mockReq, mockRes);
  } catch (error) {
    console.error('Error in bench-runs:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  try {
    if (url.pathname === '/api/ai-correlate') {
      await handleAiCorrelate(req, res);
    } else if (url.pathname === '/api/promql') {
      await handlePromql(req, res);
    } else if (url.pathname === '/api/bench-runs') {
      await handleBenchRuns(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ API server listening on http://127.0.0.1:${PORT}\n`);
  console.log('Available endpoints:');
  console.log(`  - http://localhost:${PORT}/api/ai-correlate`);
  console.log(`  - http://localhost:${PORT}/api/promql`);
  console.log(`  - http://localhost:${PORT}/api/bench-runs\n`);
  console.log('Press Ctrl+C to stop\n');
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down API server...');
  server.close(() => process.exit(0));
});
