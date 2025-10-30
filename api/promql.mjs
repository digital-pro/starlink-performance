export default async function handler(req, res) {
  try {
    const raw = (process.env.PROM_URL || '').trim();
    if (!raw) {
      res.status(500).json({ error: "PROM_URL env var not set", hint: "Set PROM_URL to your Prometheus API base (ends with /api/v1)" });
      return;
    }
    const baseUrl = raw.replace(/\/$/, '');

    const url = new URL(req.url, 'http://localhost');
    const endpointParam = (url.searchParams.get('endpoint') || '').toLowerCase();
    const useSeries = endpointParam === 'series' || url.searchParams.get('series') === '1';

    const query = url.searchParams.get('query');
    let start = url.searchParams.get('start');
    let end = url.searchParams.get('end');
    const step = url.searchParams.get('step');

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (process.env.PROM_BASIC) {
      headers['Authorization'] = `Basic ${process.env.PROM_BASIC}`;
    } else if (process.env.PROM_BEARER) {
      headers['Authorization'] = `Bearer ${process.env.PROM_BEARER}`;
    } else if (process.env.PROM_USER && process.env.PROM_TOKEN) {
      const basic = Buffer.from(`${process.env.PROM_USER}:${process.env.PROM_TOKEN}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    // Normalize to include /api/v1 if caller passed base without it
    const apiBase = /\/api\/v1$/.test(baseUrl) ? baseUrl : `${baseUrl.replace(/\/$/, '')}/api/v1`;

    let upstream = '';
    if (useSeries) {
      // Series endpoint requires start/end. Default to last hour if not provided.
      const now = Math.floor(Date.now() / 1000);
      if (!end) end = String(now);
      if (!start) start = String(now - 3600);
      const matchExpr = url.searchParams.get('match') || url.searchParams.get('match[]') || '{job="starlink"}';
      const params = new URLSearchParams();
      params.append('match[]', matchExpr);
      params.set('start', start);
      params.set('end', end);
      upstream = `${apiBase}/series?${params.toString()}`;
    } else {
      if (!query) {
        res.status(400).json({ error: "Missing 'query' parameter" });
        return;
      }
      const isRange = Boolean(start && end && step);
      const endpoint = isRange ? 'query_range' : 'query';
      const params = new URLSearchParams();
      params.set('query', query);
      if (isRange) {
        params.set('start', start);
        params.set('end', end);
        params.set('step', step);
      }
      upstream = `${apiBase}/${endpoint}?${params.toString()}`;
    }

    const response = await fetch(upstream, { headers });
    const text = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('x-upstream-url', upstream);
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/json');
    res.status(response.status).send(text);
  } catch (error) {
    res.status(500).json({ error: String(error && error.message ? error.message : error) });
  }
}
