export default async function handler(req, res) {
  const baseUrl = process.env.NOCO_URL;
  const tableId = process.env.NOCO_TABLE_ID;
  const token = process.env.NOCO_TOKEN;
  if (!baseUrl || !tableId || !token) {
    res.status(500).json({ error: "Faltam variáveis NOCO_URL, NOCO_TABLE_ID, NOCO_TOKEN" });
    return;
  }
  const endpoint = `${baseUrl.replace(/\/+$/,'')}/api/v2/tables/${tableId}/records`;

  if (req.method === "GET") {
    const status = req.query.status;
    const url = new URL(endpoint);
    url.searchParams.set("limit", "999");
    if (status !== undefined) url.searchParams.set("where", `status,eq,${status}`);
    const r = await fetch(url, { headers: { "xc-token": token } });
    const data = await r.json();
    const rows = data?.list || data?.rows || data || [];
    res.status(200).json({ rows });
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const payload = {
      nome: body.nome || "",
      whatsapp: body.whatsapp || "",
      nome2: body.nome2 || "",
      template: body.template || "",
      status: body.status ?? "",
    };
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xc-token": token },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}