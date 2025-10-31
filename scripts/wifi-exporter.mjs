#!/usr/bin/env node
import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PORT = 9818;

async function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
    
    // Set timeout for HTTP request
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('HTTP request timeout'));
    });
  });
}

async function getWiFiLinkSpeed() {
  // Retry logic for PowerShell command
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use PowerShell to get WiFi adapter speed
      // This worked before - get all adapters as JSON and filter in Node
      const { stdout, stderr } = await execAsync(
        '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command "Get-NetAdapter | Select-Object Name, LinkSpeed, Status, InterfaceDescription | ConvertTo-Json"',
        { timeout: 8000, maxBuffer: 1024 * 1024, killSignal: 'SIGTERM' }
      );
      
      if (!stdout || stdout.trim().length === 0) {
        if (attempt < maxRetries) {
          console.warn(`Attempt ${attempt}/${maxRetries}: Empty output from PowerShell, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return null;
      }
      
      const adapters = JSON.parse(stdout);
      const adapterList = Array.isArray(adapters) ? adapters : [adapters];
      
      // Find WiFi adapter that's up
      const wifiAdapter = adapterList.find(a => 
        a && a.Status === 'Up' && 
        (a.InterfaceDescription?.includes('Wi-Fi') || a.Name?.includes('Wi-Fi'))
      );
      
      if (wifiAdapter && wifiAdapter.LinkSpeed) {
        // Parse "65 Mbps" or "1.2 Gbps" format
        const match = wifiAdapter.LinkSpeed.match(/^([\d.]+)\s*(Mbps|Gbps|bps)/i);
        if (match) {
          let speed = parseFloat(match[1]);
          if (match[2].toLowerCase() === 'gbps') {
            speed *= 1000; // Convert Gbps to Mbps
          } else if (match[2].toLowerCase() === 'bps') {
            speed = 0; // Handle "0 bps" as disconnected
          }
          return speed > 0 ? speed : null;
        }
      }
      return null;
    } catch (error) {
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt}/${maxRetries}: Error fetching WiFi speed: ${error.message}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      console.error(`Error fetching WiFi speed after ${maxRetries} attempts:`, error.message);
      if (error.stderr) console.error('Command stderr:', error.stderr);
      return null;
    }
  }
  return null;
}

async function getStarlinkBandwidth() {
  try {
    // Fetch Starlink throughput from Prometheus (via Starlink exporter)
    // This gives actual bandwidth to Starlink, not theoretical WiFi speed
    const data = await httpGet('http://localhost:9090/api/v1/query?query=starlink_dish_downlink_throughput_bytes');
    
    if (data && data.data && data.data.result && data.data.result.length > 0) {
      const bytesPerSecond = parseFloat(data.data.result[0].value[1]);
      // Convert bytes/sec to Mbps
      const mbps = (bytesPerSecond * 8) / (1024 * 1024);
      return mbps > 0 ? mbps : null;
    }
    return null;
  } catch (error) {
    // Prometheus not available or query failed
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    // Set a timeout for the entire request
    const requestTimeout = setTimeout(() => {
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('# WiFi exporter timeout - returning empty metrics\n');
      }
    }, 10000); // 10 second timeout for entire request
    
    try {
      // Use Promise.allSettled to ensure both complete even if one fails
      const [wifiResult, starlinkResult] = await Promise.allSettled([
        getWiFiLinkSpeed(),
        getStarlinkBandwidth()
      ]);
      
      const wifiSpeed = wifiResult.status === 'fulfilled' ? wifiResult.value : null;
      const starlinkBandwidth = starlinkResult.status === 'fulfilled' ? starlinkResult.value : null;
      
      clearTimeout(requestTimeout);
      
      let metrics = '# HELP windows_wifi_link_speed_mbps Windows WiFi adapter link speed in Mbps\n';
      metrics += '# TYPE windows_wifi_link_speed_mbps gauge\n';
      
      if (wifiSpeed !== null) {
        metrics += `windows_wifi_link_speed_mbps ${wifiSpeed}\n`;
      }
      
      metrics += '\n# HELP starlink_bandwidth_mbps Actual Starlink connection bandwidth in Mbps\n';
      metrics += '# TYPE starlink_bandwidth_mbps gauge\n';
      
      if (starlinkBandwidth !== null) {
        metrics += `starlink_bandwidth_mbps ${starlinkBandwidth}\n`;
      }
      
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(metrics);
      }
    } catch (error) {
      clearTimeout(requestTimeout);
      console.error('Error in metrics handler:', error);
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('# WiFi exporter error - returning empty metrics\n');
      }
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`WiFi exporter listening on http://127.0.0.1:${PORT}/metrics`);
});
