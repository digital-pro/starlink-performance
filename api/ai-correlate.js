export default async function handler(req, res) {
  try {
    const raw = (process.env.PROM_URL || '').trim();
    if (!raw) {
      res.status(500).json({ error: 'PROM_URL env var not set' });
      return;
    }
    const baseUrl = /\/api\/v1$/.test(raw) ? raw.replace(/\/$/, '') : `${raw.replace(/\/$/, '')}/api/v1`;

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (process.env.PROM_BASIC) headers['Authorization'] = `Basic ${process.env.PROM_BASIC}`;
    else if (process.env.PROM_BEARER) headers['Authorization'] = `Bearer ${process.env.PROM_BEARER}`;
    else if (process.env.PROM_USER && process.env.PROM_TOKEN) {
      const basic = Buffer.from(`${process.env.PROM_USER}:${process.env.PROM_TOKEN}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    const url = new URL(req.url, 'http://localhost');
    const seconds = Math.max(300, Math.min(3600, Number(url.searchParams.get('seconds') || '900')));
    const step = Math.max(5, Math.min(30, Number(url.searchParams.get('step') || '10')));
    const end = Math.floor(Date.now() / 1000);
    const start = end - seconds;

    async function rangeQuery(expr) {
      const params = new URLSearchParams();
      params.set('query', expr);
      params.set('start', String(start));
      params.set('end', String(end));
      params.set('step', String(step));
      const r = await fetch(`${baseUrl}/query_range?${params.toString()}`, { headers });
      const j = await r.json();
      return j?.data?.result?.[0]?.values || [];
    }

    // Fetch time series
    const [latency, drops, cpu] = await Promise.all([
      rangeQuery('starlink_latency_ms'),
      rangeQuery('sum(rate(node_network_receive_drop_total[2m]) + rate(node_network_transmit_drop_total[2m]))'),
      rangeQuery('100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[2m])))')
    ]);

    function toPairs(a) {
      return a.map(([t, v]) => [Number(t), Number(v)]).filter(([, v]) => Number.isFinite(v));
    }
    const lat = toPairs(latency);
    const drp = toPairs(drops);
    const cpuu = toPairs(cpu);

    function align(a, b) {
      const map = new Map(a.map(([t, v]) => [t, v]));
      const outA = []; const outB = [];
      for (const [t, v] of b) {
        if (map.has(t)) { outA.push(map.get(t)); outB.push(v); }
      }
      return [outA, outB];
    }

    function pearson(x, y) {
      const n = Math.min(x.length, y.length);
      if (n < 3) return null;
      let sx=0, sy=0, sxx=0, syy=0, sxy=0;
      for (let i=0;i<n;i++){ const xv=x[i]; const yv=y[i]; sx+=xv; sy+=yv; sxx+=xv*xv; syy+=yv*yv; sxy+=xv*yv; }
      const cov = sxy/n - (sx/n)*(sy/n);
      const vx = sxx/n - (sx/n)*(sx/n);
      const vy = syy/n - (sy/n)*(sy/n);
      const denom = Math.sqrt(vx*vy);
      if (!Number.isFinite(denom) || denom===0) return null;
      return cov/denom;
    }

    function autocorr(series, lagSteps) {
      const n = series.length;
      if (n < lagSteps + 3) return null;
      let sx=0, sxx=0; for (const v of series) { sx+=v; sxx+=v*v; }
      const mean = sx/n; const varx = sxx/n - mean*mean; if (varx<=0) return null;
      let sxy=0; for (let i=lagSteps;i<n;i++){ sxy += (series[i]-mean)*(series[i-lagSteps]-mean); }
      return (sxy/(n-lagSteps)) / varx;
    }

    const [lat_drp_A, lat_drp_B] = align(lat, drp);
    const [lat_cpu_A, lat_cpu_B] = align(lat, cpuu);
    const corrLatencyDrops = pearson(lat_drp_A, lat_drp_B);
    const corrLatencyCpu = pearson(lat_cpu_A, lat_cpu_B);

    const latOnly = lat.map(([,v])=>v);
    const ac15s = autocorr(latOnly, Math.round(15/step));
    const periodic15s = ac15s !== null && ac15s > 0.3;

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      window: { start, end, step },
      corr: { latency_vs_drops: corrLatencyDrops, latency_vs_cpu: corrLatencyCpu },
      periodicity: { ac_15s: ac15s, detected: periodic15s }
    });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}


