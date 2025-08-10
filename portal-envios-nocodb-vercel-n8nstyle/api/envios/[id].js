export default async function handler(req, res) {
  const baseUrl = process.env.NOCO_URL;
  const tableId = process.env.NOCO_TABLE_ID;
  const token = process.env.NOCO_TOKEN;
  if (!baseUrl || !tableId || !token) {
    res.status(500).json({ error: "Faltam variáveis NOCO_URL, NOCO_TABLE_ID, NOCO_TOKEN" });
    return;
  }
  const { id } = req.query;
  const endpoint = `${baseUrl.replace(/\/+$/,'')}/api/v2/tables/${tableId}/records/${id}`;

  if (req.method === "PATCH") {
    const r = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json", "xc-token": token }, body: JSON.stringify(req.body || {}) });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
    return;
  }

  if (req.method === "DELETE") {
    const r = await fetch(endpoint, { method: "DELETE", headers: { "xc-token": token } });
    let data = null; try { data = await r.json(); } catch {}
    res.status(r.ok ? 200 : r.status).json(data || { ok: r.ok });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}