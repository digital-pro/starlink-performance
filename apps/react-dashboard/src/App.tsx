import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';

function useLatest(chart: string) {
  const [value, setValue] = useState<number | 'N/A'>('N/A');
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await axios.get(`/api/netdata?chart=${encodeURIComponent(chart)}&after=-300&points=1&format=json`);
        const data = res.data?.data;
        if (Array.isArray(data) && data.length > 0) {
          const last = data[data.length - 1];
          const v = typeof last[0] === 'number' ? last[0] : 'N/A';
          if (isMounted) setValue(v);
        }
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [chart]);
  return value;
}

function useSeries(chart: string, seconds = 600, points = 100) {
  const [series, setSeries] = useState<Array<[number, number]>>([]);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await axios.get(`/api/netdata?chart=${encodeURIComponent(chart)}&after=-${seconds}&points=${points}&format=json`);
        const data: number[][] | undefined = res.data?.data;
        if (!data || data.length === 0) return;
        const s = data.map((row, idx) => {
          const ts = (res.data?.view_latest || 0) - (seconds - (seconds / points) * idx);
          const value = row.find(v => typeof v === 'number') ?? NaN;
          return [ts * 1000, Number(value)];
        }).filter(pair => !Number.isNaN(pair[1]));
        if (isMounted) setSeries(s);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [chart, seconds, points]);
  return series;
}

export default function App() {
  const [host, setHost] = useState<string>(() => localStorage.getItem('NETDATA_HOST') || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const latency = useLatest('starlink.ping');
  const packetLoss = useLatest('starlink.packet_loss');
  const bandwidthDown = useLatest('starlink.bandwidth_down');
  const bandwidthUp = useLatest('starlink.bandwidth_up');
  const anomalyRate = useLatest('anomaly_detection.anomaly_rate');

  const latencySeries = useSeries('starlink.ping');
  const downSeries = useSeries('starlink.bandwidth_down');
  const upSeries = useSeries('starlink.bandwidth_up');

  const latencyOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 24, bottom: 40 },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', name: 'ms' },
    series: [
      { type: 'line', name: 'Latency', data: latencySeries, showSymbol: false, smooth: true }
    ]
  }), [latencySeries]);

  const bandwidthOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['Down', 'Up'] },
    grid: { left: 40, right: 16, top: 24, bottom: 40 },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', name: 'Mbps' },
    series: [
      { type: 'line', name: 'Down', data: downSeries, showSymbol: false, smooth: true },
      { type: 'line', name: 'Up', data: upSeries, showSymbol: false, smooth: true }
    ]
  }), [downSeries, upSeries]);

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Levante Performance (React)</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={inputRef} defaultValue={host} placeholder="NETDATA_HOST (e.g. 192.168.1.50)" style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, width: 260 }} />
          <button onClick={() => { const v = inputRef.current?.value || ''; localStorage.setItem('NETDATA_HOST', v); setHost(v); }} style={{ padding: '8px 12px', border: '1px solid #0a7', background: '#0a7', color: 'white', borderRadius: 8, cursor: 'pointer' }}>Save</button>
        </div>
      </header>

      <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {[{ k: 'Latency (ms)', v: latency }, { k: 'Packet Loss (%)', v: packetLoss }, { k: 'Down (Mbps)', v: bandwidthDown }, { k: 'Up (Mbps)', v: bandwidthUp }, { k: 'Anomaly Rate (%)', v: anomalyRate }].map((c) => (
          <div key={c.k} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: 'white' }}>
            <div style={{ fontWeight: 600, color: '#445' }}>{c.k}</div>
            <div style={{ fontSize: 28, marginTop: 8, color: '#111' }}>{String(c.v)}</div>
            <small style={{ color: '#778' }}>Latest</small>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Latency (last 10 min)</h3>
            <small style={{ color: '#778' }}>starlink.ping</small>
          </div>
          <ReactECharts option={latencyOption} style={{ height: 260, marginTop: 8 }} notMerge lazyUpdate/>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Bandwidth (Down / Up)</h3>
            <small style={{ color: '#778' }}>starlink.bandwidth_down / starlink.bandwidth_up</small>
          </div>
          <ReactECharts option={bandwidthOption} style={{ height: 260, marginTop: 8 }} notMerge lazyUpdate/>
        </div>
      </section>

      <footer style={{ marginTop: 24, color: '#667' }}>
        <small>
          Data proxied via <code>/api/netdata</code>. Configure NETDATA_HOST in Vercel or above. This is a starter UI; extend with alerts, gauges, and trend comparisons.
        </small>
      </footer>
    </main>
  );
}
