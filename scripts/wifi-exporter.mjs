#!/usr/bin/env node
import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PORT = 9818;

async function getWiFiLinkSpeed() {
  try {
    // Simpler PowerShell command - get all adapters and filter in Node
    const { stdout } = await execAsync(
      '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "Get-NetAdapter | Select-Object Name, LinkSpeed, Status, InterfaceDescription | ConvertTo-Json"',
      { timeout: 5000 }
    );
    
    const adapters = JSON.parse(stdout);
    const adapterList = Array.isArray(adapters) ? adapters : [adapters];
    
    // Find WiFi adapter that's up
    const wifiAdapter = adapterList.find(a => 
      a.Status === 'Up' && 
      (a.InterfaceDescription?.includes('Wi-Fi') || a.Name?.includes('Wi-Fi'))
    );
    
    if (wifiAdapter && wifiAdapter.LinkSpeed) {
      // Parse "65 Mbps" or "1.2 Gbps" format
      const match = wifiAdapter.LinkSpeed.match(/^([\d.]+)\s*(Mbps|Gbps)/i);
      if (match) {
        let speed = parseFloat(match[1]);
        if (match[2].toLowerCase() === 'gbps') {
          speed *= 1000; // Convert Gbps to Mbps
        }
        return speed;
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching WiFi speed:', error.message);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    const speed = await getWiFiLinkSpeed();
    
    let metrics = '# HELP windows_wifi_link_speed_mbps Windows WiFi adapter link speed in Mbps\n';
    metrics += '# TYPE windows_wifi_link_speed_mbps gauge\n';
    
    if (speed !== null) {
      metrics += `windows_wifi_link_speed_mbps ${speed}\n`;
    }
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`WiFi exporter listening on http://127.0.0.1:${PORT}/metrics`);
});
