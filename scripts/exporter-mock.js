#!/usr/bin/env node
const http = require('node:http');

const port = Number(process.env.PORT || 9817);
const host = '0.0.0.0';

function metricsBody() {
  const now = Math.floor(Date.now() / 1000);
  const lines = [
    '# HELP starlink_dish_pop_ping_latency_seconds Mock latency',
    '# TYPE starlink_dish_pop_ping_latency_seconds gauge',
    `starlink_dish_pop_ping_latency_seconds ${0.05 + Math.random() * 0.02} ${now}000`,
    '# HELP starlink_dish_pop_ping_drop_ratio Mock packet loss ratio',
    '# TYPE starlink_dish_pop_ping_drop_ratio gauge',
    `starlink_dish_pop_ping_drop_ratio ${Math.random() * 0.01} ${now}000`,
    '# HELP starlink_dish_downlink_throughput_bytes Mock down bytes/sec',
    '# TYPE starlink_dish_downlink_throughput_bytes gauge',
    `starlink_dish_downlink_throughput_bytes ${10_000_000 + Math.floor(Math.random() * 2_000_000)} ${now}000`,
    '# HELP starlink_dish_uplink_throughput_bytes Mock up bytes/sec',
    '# TYPE starlink_dish_uplink_throughput_bytes gauge',
    `starlink_dish_uplink_throughput_bytes ${2_000_000 + Math.floor(Math.random() * 500_000)} ${now}000`,
    '# HELP starlink_dish_up Mock exporter up',
    '# TYPE starlink_dish_up gauge',
    `starlink_dish_up 1 ${now}000`,
  ];
  return lines.join('\n') + '\n';
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/metrics')) {
    const body = metricsBody();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.end(body);
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('starlink exporter mock\n');
});

server.listen(port, host, () => {
  console.log(`Mock exporter listening on http://${host}:${port}`);
});
