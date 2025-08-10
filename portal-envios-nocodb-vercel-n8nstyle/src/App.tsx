// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Check, Search, ArrowRight, Trash2 } from "lucide-react";

// Paleta "n8n-like"
const bg = "bg-[#0b0f17]";
const panel = "bg-[#0f1524]";
const border = "border-[#1a2340]";
const accent = "from-[#7c4dff] to-[#3dd6d0]"; // roxo -> ciano
const accentSoft = "bg-gradient-to-b from-[#7c4dff1a] to-[#3dd6d01a]";
const textSoft = "text-slate-300";
const COST_RATE_USD = 0.06;

type Row = {
  id: string;
  nome: string;      // Cliente
  whatsapp: string;
  nome2?: string;    // Indicação
  template: string;
  status?: string;
  created_at?: string;
};

async function apiList(status?: string): Promise<Row[]> {
  const url = status ? `/api/envios?status=${encodeURIComponent(status)}` : "/api/envios";
  const r = await fetch(url);
  if (!r.ok) throw new Error("Falha ao listar");
  const data = await r.json();
  const rows = Array.isArray(data) ? data : (data.rows || data.list || []);
  return rows as Row[];
}
async function apiCreate(payload: Partial<Row>) {
  const r = await fetch("/api/envios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error("Falha ao criar");
  return r.json();
}
async function apiPatch(id: string, body: any) {
  const r = await fetch(`/api/envios/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("Falha ao atualizar");
  return r.json();
}
async function apiDelete(id: string) {
  const r = await fetch(`/api/envios/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Falha ao excluir");
  try { return await r.json(); } catch { return { ok: true } }
}

// CSV: whatsapp,cliente,template,indicacao
function parseBulk(text: string): Partial<Row>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase();
  let start = 0;
  let map = { whatsapp: 0, cliente: 1, template: 2, indicacao: 3 } as any;
  if (header.includes("whatsapp") && header.includes("cliente") && header.includes("template")) {
    start = 1;
    const cols = header.split(",").map(s => s.trim());
    map = {
      whatsapp: cols.indexOf("whatsapp"),
      cliente: cols.indexOf("cliente"),
      template: cols.indexOf("template"),
      indicacao: cols.indexOf("indicacao"),
    };
  }
  const out: Partial<Row>[] = [];
  for (let i=start;i<lines.length;i++) {
    const p = lines[i].split(",").map(s => s.trim());
    const whatsapp = p[map.whatsapp] || "";
    const cliente = p[map.cliente] || "";
    const template = p[map.template] || "";
    const indicacao = p[map.indicacao] || "";
    if (!whatsapp || !cliente || !template) continue;
    out.push({ whatsapp, nome: cliente, template, nome2: indicacao, status: "" });
  }
  return out;
}

export default function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [cliente, setCliente] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [indicacao, setIndicacao] = useState("");
  const [template, setTemplate] = useState("");
  const [query, setQuery] = useState("");
  const [dateStart, setDateStart] = useState(() => new Date(Date.now()-30*864e5).toISOString().slice(0,10));
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().slice(0,10));

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState(`whatsapp,cliente,template,indicacao
+55 41 99999-0004,Camila,boas_vindas_1,
+55 41 99999-0005,Caio,oferta,Instagram
`);

  async function refresh() {
    setLoading(true);
    try {
      const list = await apiList();
      setRows(list);
    } catch (e:any) {
      alert(e.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const pendentes = rows.filter(r => !r.status).length;
    const enviados = rows.filter(r => r.status === "enviado").length;
    return { total, pendentes, enviados };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.nome||"").toLowerCase().includes(q) ||
      String(r.template||"").toLowerCase().includes(q) ||
      String(r.whatsapp||"").toLowerCase().includes(q) ||
      String(r.nome2||"").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const costInfo = useMemo(() => {
    const start = new Date(dateStart + "T00:00:00");
    const end = new Date(dateEnd + "T23:59:59");
    const sent = rows.filter(r => r.status==="enviado" && r.created_at && new Date(r.created_at)>=start && new Date(r.created_at)<=end);
    const count = sent.length;
    return { count, cost: count * COST_RATE_USD };
  }, [rows, dateStart, dateEnd]);

  async function handleAdd() {
    if (!cliente.trim() || !template.trim() || !whatsapp.trim()) {
      alert("Preencha Cliente, WhatsApp e Template");
      return;
    }
    await apiCreate({ nome: cliente.trim(), whatsapp: whatsapp.trim(), nome2: indicacao.trim(), template: template.trim(), status: "" });
    setCliente(""); setWhatsapp(""); setIndicacao(""); setTemplate("");
    refresh();
  }
  async function bulkImport() {
    const items = parseBulk(bulkText);
    if (!items.length) return alert("Nada importado");
    for (const it of items) await apiCreate(it);
    setBulkOpen(false); refresh();
  }
  async function markSent(id: string) { await apiPatch(id, { status: "enviado" }); refresh(); }
  async function markPending(id: string) { await apiPatch(id, { status: "" }); refresh(); }
  async function removeRow(id: string) { if (!confirm("Remover este registro?")) return; await apiDelete(id); refresh(); }

  return (
    <div className={`min-h-screen ${bg} text-slate-100 p-4 md:p-6 max-w-6xl mx-auto`}>
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl bg-gradient-to-tr ${accent} shadow-[0_10px_30px_rgba(124,77,255,.35)]`} />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Portal de Envios</h1>
              <p className="text-[11px] text-slate-400">NocoDB • Vercel</p>
            </div>
          </div>
          <a href="https://nocodb.liggas.shop/" target="_blank" className="group inline-flex items-center gap-1 rounded-lg border border-transparent px-3 py-2 text-sm text-slate-200 transition hover:border-[#3dd6d0]/40 hover:bg-[#3dd6d0]/10">
            NocoDB <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className={`rounded-2xl ${accentSoft} border ${border} p-5 transition hover:shadow-[0_10px_30px_rgba(61,214,208,.18)]`}>
          <div className={`${textSoft} text-sm`}>Total</div><div className="mt-1 text-3xl font-semibold">{stats.total}</div>
        </div>
        <div className={`rounded-2xl ${panel} border ${border} p-5 hover:border-[#7c4dff]/40 transition`}>
          <div className={`${textSoft} text-sm`}>Pendentes</div><div className="mt-1 text-3xl font-semibold">{stats.pendentes}</div>
        </div>
        <div className={`rounded-2xl ${panel} border ${border} p-5 hover:border-[#3dd6d0]/40 transition`}>
          <div className={`${textSoft} text-sm`}>Enviados</div><div className="mt-1 text-3xl font-semibold">{stats.enviados}</div>
        </div>
      </section>

      {/* Período */}
      <section className={`rounded-2xl ${panel} border ${border} p-4 mb-6`}>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs text-slate-400">De</label><input type="date" value={dateStart} onChange={e=>setDateStart(e.target.value)} className="block rounded-xl border border-[#243055] bg-[#111936] px-3 py-2 outline-none focus:border-[#3dd6d0]/60" /></div>
          <div><label className="text-xs text-slate-400">Até</label><input type="date" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} className="block rounded-xl border border-[#243055] bg-[#111936] px-3 py-2 outline-none focus:border-[#3dd6d0]/60" /></div>
          <div className="rounded-xl border border-[#243055] bg-[#0f1524] px-4 py-2 text-sm">{costInfo.count} enviados x $ {COST_RATE_USD.toFixed(2)} = <b>$ {costInfo.cost.toFixed(2)}</b></div>
        </div>
      </section>

      {/* Form */}
      <section className={`rounded-2xl ${panel} border ${border} p-5 mb-6`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Novo envio</h2>
          <button onClick={()=>setBulkOpen(v=>!v)} className="rounded-xl border border-[#243055] bg-[#10172b] px-3 py-2 text-sm transition hover:border-[#7c4dff]/50 hover:bg-[#151d34]">Importar em massa</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input placeholder="Cliente" value={cliente} onChange={e=>setCliente(e.target.value)} className="rounded-xl border border-[#243055] bg-[#111936] px-3 py-2 outline-none focus:border-[#7c4dff]/60"/>
          <input placeholder="WhatsApp" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} className="rounded-xl border border-[#243055] bg-[#111936] px-3 py-2 outline-none focus:border-[#7c4dff]/60"/>
          <input placeholder="Indicação (opcional)" value={indicacao} onChange={e=>setIndicacao(e.target.value)} className="rounded-xl border border-[#243055] bg-[#111936] px-3 py-2 outline-none focus:border-[#7c4dff]/60"/>
          <input placeholder="Template" value={template} onChange={e=>setTemplate(e.target.value)} className="rounded-xl border border-[#243055] bg-[#111936] px-3 py-2 outline-none focus:border-[#7c4dff]/60"/>
        </div>
        <div className="mt-4">
          <button onClick={handleAdd} className={`rounded-xl bg-gradient-to-tr ${accent} px-5 py-2.5 font-semibold text-slate-900 shadow-[0_10px_28px_rgba(124,77,255,.35)] transition hover:brightness-110 active:scale-[.99]`}>Cadastrar</button>
        </div>

        {bulkOpen && (
          <div className="mt-4">
            <p className="text-sm text-slate-300 mb-1">Cole CSV (<code>whatsapp,cliente,template,indicacao</code>)</p>
            <textarea rows={6} value={bulkText} onChange={e=>setBulkText(e.target.value)} className="w-full rounded-xl border border-[#243055] bg-[#0f1524] p-2 text-sm outline-none focus:border-[#3dd6d0]/60"/>
            <div className="mt-2 flex gap-2">
              <button onClick={bulkImport} className="rounded-xl border border-[#3dd6d0]/50 bg-[#3dd6d0]/20 px-3 py-2 text-sm text-[#9ff1ed] hover:bg-[#3dd6d0]/30">Importar</button>
              <button onClick={()=>setBulkOpen(false)} className="rounded-xl border border-[#243055] bg-[#10172b] px-3 py-2 text-sm hover:bg-[#151d34]">Fechar</button>
            </div>
          </div>
        )}
      </section>

      {/* Lista */}
      <section className={`rounded-2xl ${panel} border ${border} p-5`}>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input placeholder="Buscar por Cliente, WhatsApp, Template…" value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-xl border border-[#243055] bg-[#111936] py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#3dd6d0]/60"/>
        </div>
        {loading ? <p className="text-slate-400">Carregando…</p> : (
          <div className="space-y-3">
            {filtered.map(r => (
              <div key={r.id} className={`rounded-xl border ${border} bg-[#0f1524] p-3 transition hover:border-[#7c4dff]/40`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{r.nome}</div>
                    <div className="text-xs text-slate-400">{r.whatsapp}</div>
                    {r.nome2 && <div className="text-xs text-slate-400">Indicação: {r.nome2}</div>}
                  </div>
                  <div className="text-xs">{r.status === "enviado" ? <span className="text-emerald-300">enviado</span> : <span className="text-amber-300">pendente</span>}</div>
                </div>
                <div className="text-xs text-slate-300 mt-1">Template: {r.template}</div>
                <div className="mt-2 flex gap-2">
                  {r.status !== "enviado" ? (
                    <button onClick={()=>apiPatch(r.id, { status: "enviado" }).then(refresh)} className="rounded-md border border-[#3dd6d0]/50 bg-[#3dd6d0]/10 px-3 py-1.5 text-xs hover:bg-[#3dd6d0]/20">marcar enviado</button>
                  ) : (
                    <button onClick={()=>apiPatch(r.id, { status: "" }).then(refresh)} className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs hover:bg-amber-400/20">pendente</button>
                  )}
                  <button onClick={()=>apiDelete(r.id).then(refresh)} className="rounded-md border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-xs hover:bg-rose-400/20 inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5"/> excluir</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-slate-400 text-sm">Nenhum registro</div>}
          </div>
        )}
      </section>
    </div>
  );
}
