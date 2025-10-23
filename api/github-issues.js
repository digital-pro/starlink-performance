export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const token = process.env.GH_TOKEN || '';
    const repoParam = req.query.repo || process.env.GH_REPO || '';
    const owner = req.query.owner;
    const repoOnly = req.query.repoOnly;
    const label = req.query.label || '';
    const state = req.query.state || 'open';
    const perPage = Math.min(Number(req.query.per_page || 20), 100);

    let repo = repoParam;
    if (!repo && owner && repoOnly) repo = `${owner}/${repoOnly}`;
    if (!repo) {
      res.status(400).json({ error: 'Missing repo. Provide ?repo=owner/name or set GH_REPO env.' });
      return;
    }

    const qs = new URLSearchParams();
    qs.set('state', state);
    qs.set('per_page', String(perPage));
    if (label) qs.set('labels', label);

    const url = `https://api.github.com/repos/${repo}/issues?${qs.toString()}`;

    const headers = { 'Accept': 'application/vnd.github+json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // GitHub requires an API version header for some orgs; include stable default
    headers['X-GitHub-Api-Version'] = '2022-11-28';

    const ghRes = await fetch(url, { headers });
    const text = await ghRes.text();
    if (!ghRes.ok) {
      res.status(ghRes.status).json({ error: `GitHub error ${ghRes.status}`, body: text });
      return;
    }

    let data;
    try { data = JSON.parse(text); } catch { data = []; }
    // Normalize minimal fields for the dashboard
    const issues = Array.isArray(data) ? data.map(it => ({
      id: it.id,
      number: it.number,
      title: it.title,
      state: it.state,
      html_url: it.html_url,
      labels: (it.labels || []).map(l => typeof l === 'string' ? l : l.name).filter(Boolean),
      created_at: it.created_at,
      updated_at: it.updated_at,
      user: it.user ? { login: it.user.login, html_url: it.user.html_url } : null
    })) : [];

    res.status(200).json({ ok: true, repo, count: issues.length, issues });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: String(err?.message || err) });
  }
}



