import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';

type DataSource = 'netdata' | 'prom';

function useLatestNetdata(chart: string) {
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

function useSeriesNetdata(chart: string, seconds = 600, points = 100) {
  const [series, setSeries] = useState<Array<[number, number]>>([]);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await axios.get(`/api/netdata?chart=${encodeURIComponent(chart)}&after=-${seconds}&points=${points}&format=json`);
        const data: number[][] | undefined = res.data?.data;
        if (!data || data.length === 0) return;
        const step = seconds / Math.max(points, 1);
        const s = data.map((row, idx) => {
          const ts = (res.data?.view_latest || 0) - (seconds - step * idx);
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

function useInstantProm(query: string) {
  const [value, setValue] = useState<number | 'N/A'>('N/A');
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await axios.get(`/api/promql`, { params: { query } });
        const result = res.data?.data?.result;
        if (Array.isArray(result) && result.length > 0) {
          const v = Number(result[0]?.value?.[1]);
          if (isMounted) setValue(Number.isFinite(v) ? v : 'N/A');
        }
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [query]);
  return value;
}

function useRangeProm(query: string, seconds = 600, step = 10) {
  const [series, setSeries] = useState<Array<[number, number]>>([]);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const end = Math.floor(Date.now() / 1000);
        const start = end - seconds;
        const res = await axios.get(`/api/promql`, { params: { query, start, end, step } });
        const result = res.data?.data?.result as Array<any> | undefined;
        const values = result && result[0]?.values as Array<[number, string]> | undefined;
        if (!values) return;
        const s = values.map(([ts, v]) => [Number(ts) * 1000, Number(v)]).filter(([, v]) => Number.isFinite(v));
        if (isMounted) setSeries(s);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [query, seconds, step]);
  return series;
}

export default function App() {
  const [dataSource, setDataSource] = useState<DataSource>(() => (localStorage.getItem('DATA_SOURCE') as DataSource) || 'netdata');
  const [host, setHost] = useState<string>(() => localStorage.getItem('NETDATA_HOST') || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Netdata metrics
  const latencyND = useLatestNetdata('starlink.ping');
  const packetLossND = useLatestNetdata('starlink.packet_loss');
  const bandwidthDownND = useLatestNetdata('starlink.bandwidth_down');
  const bandwidthUpND = useLatestNetdata('starlink.bandwidth_up');
  const anomalyRateND = useLatestNetdata('anomaly_detection.anomaly_rate');
  const latencySeriesND = useSeriesNetdata('starlink.ping');
  const downSeriesND = useSeriesNetdata('starlink.bandwidth_down');
  const upSeriesND = useSeriesNetdata('starlink.bandwidth_up');

  // Prometheus metrics
  const latencyPR = useInstantProm('starlink_latency_ms');
  const packetLossPR = useInstantProm('starlink_packet_loss_pct');
  const bandwidthDownPR = useInstantProm('starlink_bandwidth_down_mbps');
  const bandwidthUpPR = useInstantProm('starlink_bandwidth_up_mbps');
  const anomalyRatePR = useInstantProm('starlink_anomaly_rate_pct');
  const latencySeriesPR = useRangeProm('starlink_latency_ms');
  const downSeriesPR = useRangeProm('starlink_bandwidth_down_mbps');
  const upSeriesPR = useRangeProm('starlink_bandwidth_up_mbps');

  const latencyOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 24, bottom: 40 },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', name: 'ms' },
    series: [
      { type: 'line', name: 'Latency', data: dataSource === 'netdata' ? latencySeriesND : latencySeriesPR, showSymbol: false, smooth: true }
    ]
  }), [dataSource, latencySeriesND, latencySeriesPR]);

  const bandwidthOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['Down', 'Up'] },
    grid: { left: 40, right: 16, top: 24, bottom: 40 },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', name: 'Mbps' },
    series: [
      { type: 'line', name: 'Down', data: dataSource === 'netdata' ? downSeriesND : downSeriesPR, showSymbol: false, smooth: true },
      { type: 'line', name: 'Up', data: dataSource === 'netdata' ? upSeriesND : upSeriesPR, showSymbol: false, smooth: true }
    ]
  }), [dataSource, downSeriesND, upSeriesND, downSeriesPR, upSeriesPR]);

  const cards = useMemo(() => {
    const values = dataSource === 'netdata'
      ? { latency: latencyND, packetLoss: packetLossND, bandwidthDown: bandwidthDownND, bandwidthUp: bandwidthUpND, anomalyRate: anomalyRateND }
      : { latency: latencyPR, packetLoss: packetLossPR, bandwidthDown: bandwidthDownPR, bandwidthUp: bandwidthUpPR, anomalyRate: anomalyRatePR };
    return [
      { k: 'Latency (ms)', v: values.latency },
      { k: 'Packet Loss (%)', v: values.packetLoss },
      { k: 'Down (Mbps)', v: values.bandwidthDown },
      { k: 'Up (Mbps)', v: values.bandwidthUp },
      { k: 'Anomaly Rate (%)', v: values.anomalyRate }
    ];
  }, [dataSource, latencyND, packetLossND, bandwidthDownND, bandwidthUpND, anomalyRateND, latencyPR, packetLossPR, bandwidthDownPR, bandwidthUpPR, anomalyRatePR]);

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Levante Performance (React)</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
            <span>Data Source</span>
            <select value={dataSource} onChange={(e) => { const v = e.target.value as DataSource; setDataSource(v); localStorage.setItem('DATA_SOURCE', v); }} style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}>
              <option value="netdata">Netdata</option>
              <option value="prom">Prometheus</option>
            </select>
          </label>
          {dataSource === 'netdata' ? (
            <>
              <input ref={inputRef} defaultValue={host} placeholder="NETDATA_HOST (e.g. 192.168.1.50)" style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, width: 260 }} />
              <button onClick={() => { const v = inputRef.current?.value || ''; localStorage.setItem('NETDATA_HOST', v); setHost(v); }} style={{ padding: '8px 12px', border: '1px solid #0a7', background: '#0a7', color: 'white', borderRadius: 8, cursor: 'pointer' }}>Save</button>
            </>
          ) : (
            <small style={{ color: '#667' }}>Reads from serverless <code>/api/promql</code> (configure env PROM_URL on server)</small>
          )}
        </div>
      </header>

      <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {cards.map((c) => (
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
            <small style={{ color: '#778' }}>{dataSource === 'netdata' ? 'starlink.ping' : 'starlink_latency_ms'}</small>
          </div>
          <ReactECharts option={latencyOption} style={{ height: 260, marginTop: 8 }} notMerge lazyUpdate/>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Bandwidth (Down / Up)</h3>
            <small style={{ color: '#778' }}>{dataSource === 'netdata' ? 'starlink.bandwidth_*' : 'starlink_bandwidth_*_mbps'}</small>
          </div>
          <ReactECharts option={bandwidthOption} style={{ height: 260, marginTop: 8 }} notMerge lazyUpdate/>
        </div>
      </section>

      <footer style={{ marginTop: 24, color: '#667' }}>
        <small>
          Netdata via <code>/api/netdata</code> (set NETDATA_URL or NETDATA_HOST); Prometheus via <code>/api/promql</code> (set PROM_URL + auth). This is a starter UI; extend with alerts, gauges, and trend comparisons.
        </small>
      </footer>
    </main>
  );
}
