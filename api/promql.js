export default async function handler(req, res) {
  try {
    const baseUrl = (process.env.PROM_URL || '').trim().replace(/\/$/, '');
    if (!baseUrl) {
      res.status(500).json({ error: "PROM_URL env var not set (e.g. https://prometheus.example.com/api/v1)" });
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const query = url.searchParams.get('query');
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const step = url.searchParams.get('step');

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

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (process.env.PROM_BASIC) {
      headers['Authorization'] = `Basic ${process.env.PROM_BASIC}`; // base64(username:password)
    } else if (process.env.PROM_BEARER) {
      headers['Authorization'] = `Bearer ${process.env.PROM_BEARER}`;
    } else if (process.env.PROM_USER && process.env.PROM_TOKEN) {
      const basic = Buffer.from(`${process.env.PROM_USER}:${process.env.PROM_TOKEN}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    const upstream = `${baseUrl}/${endpoint}?${params.toString()}`;
    const response = await fetch(upstream, { headers });
    const text = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/json');
    res.status(response.status).send(text);
  } catch (error) {
    res.status(500).json({ error: String(error && error.message ? error.message : error) });
  }
}
