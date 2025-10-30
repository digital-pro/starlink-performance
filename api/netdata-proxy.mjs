export default async function handler(req, res) {
  try {
    const baseUrl = (process.env.NETDATA_URL || '').trim().replace(/\/$/, '');
    const host = (process.env.NETDATA_HOST || '').trim();

    if (!baseUrl && !host) {
      res.status(500).json({ error: "NETDATA_URL or NETDATA_HOST env var must be set" });
      return;
    }

    const url = new URL(req.url, "http://localhost");
    const chart = url.searchParams.get("chart");
    const after = url.searchParams.get("after") ?? "-300";
    const points = url.searchParams.get("points") ?? "60";
    const format = url.searchParams.get("format") ?? "json";

    if (!chart) {
      res.status(400).json({ error: "Missing required 'chart' query param" });
      return;
    }

    const upstreamBase = baseUrl || `http://${host}:19999`;
    const netdataUrl = `${upstreamBase}/api/v1/data?chart=${encodeURIComponent(chart)}&after=${encodeURIComponent(after)}&points=${encodeURIComponent(points)}&format=${encodeURIComponent(format)}`;

    const headers = {};
    if (process.env.NETDATA_AUTH_BASIC) {
      headers["Authorization"] = `Basic ${process.env.NETDATA_AUTH_BASIC}`; // value should be base64(username:password)
    } else if (process.env.NETDATA_BEARER) {
      headers["Authorization"] = `Bearer ${process.env.NETDATA_BEARER}`;
    }

    const response = await fetch(netdataUrl, { headers });
    if (!response.ok) {
      res.status(response.status).json({ error: `Netdata error ${response.status}` });
      return;
    }

    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: String(error && error.message ? error.message : error) });
  }
}
