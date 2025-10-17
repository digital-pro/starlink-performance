export default async function handler(req, res) {
  try {
    const netdataHost = process.env.NETDATA_HOST;
    if (!netdataHost) {
      res.status(500).json({ error: "NETDATA_HOST env var not set" });
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

    const netdataUrl = `http://${netdataHost}:19999/api/v1/data?chart=${encodeURIComponent(chart)}&after=${encodeURIComponent(after)}&points=${encodeURIComponent(points)}&format=${encodeURIComponent(format)}`;

    const response = await fetch(netdataUrl);
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
