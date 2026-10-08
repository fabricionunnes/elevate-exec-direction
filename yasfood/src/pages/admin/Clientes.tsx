import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, MessageCircle, Search, Pencil, UserPlus } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { brl, dateBR, formatPhone, onlyDigits, dayLabel, STATUS_COLOR, statusLabelFor } from "@/lib/format";
import { waLink, msgs } from "@/lib/whatsapp";
import type { Customer, CustomerStats, DeliveryZone, Order } from "@/lib/types";
import { Button, Badge, Card, Input, Select, Textarea, Modal, Spinner, Empty, Stat, useToast } from "@/components/ui";

type Row = Customer & Partial<CustomerStats>;
type Seg = "todos" | "leads" | "clientes" | "recorrentes" | "sumidos";

const SOURCES = ["cardapio", "whatsapp", "grupo", "indicacao", "instagram", "outro"];

export default function Clientes() {
  const toast = useToast();
  const { settings } = useSettings();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Seg>("todos");
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, s, z] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("customer_stats").select("*"),
      supabase.from("delivery_zones").select("*").order("sort_order"),
    ]);
    const stats = Object.fromEntries(((s.data as CustomerStats[]) ?? []).map((x) => [x.customer_id, x]));
    setRows(((c.data as Customer[]) ?? []).map((x) => ({ ...x, ...stats[x.id] })));
    setZones((z.data as DeliveryZone[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    if (!rows) return [];
    let l = rows;
    if (seg === "leads") l = l.filter((r) => r.kind === "lead");
    if (seg === "clientes") l = l.filter((r) => r.kind === "cliente");
    if (seg === "recorrentes") l = l.filter((r) => (r.orders_count ?? 0) >= 2);
    if (seg === "sumidos") l = l.filter((r) => (r.orders_count ?? 0) >= 1 && (r.days_since_last ?? 0) >= 30);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      l = l.filter((r) => r.name.toLowerCase().includes(s) || r.phone.includes(onlyDigits(s)) || r.address.toLowerCase().includes(s));
    }
    return l;
  }, [rows, seg, q]);

  const save = async () => {
    if (!editing?.name || !editing.phone) return toast("Nome e telefone são obrigatórios.", "err");
    setBusy(true);
    const { id, ...rest } = editing;
    const payload = { ...rest, phone: onlyDigits(rest.phone ?? ""), kind: rest.kind ?? "lead", source: rest.source ?? "whatsapp", zone_id: rest.zone_id || null };
    const { error } = id ? await supabase.from("customers").update(payload).eq("id", id) : await supabase.from("customers").insert(payload);
    setBusy(false);
    if (error) return toast(friendlyError(error).includes("duplicate") ? "Já existe cliente com esse telefone." : friendlyError(error), "err");
    toast("Salvo.");
    setEditing(null);
    void load();
  };

  const totals = useMemo(() => ({
    leads: rows?.filter((r) => r.kind === "lead").length ?? 0,
    clientes: rows?.filter((r) => r.kind === "cliente").length ?? 0,
    recorrentes: rows?.filter((r) => (r.orders_count ?? 0) >= 2).length ?? 0,
    ltv: rows?.length ? (rows.reduce((a, r) => a + Number(r.total_spent ?? 0), 0) / Math.max(1, rows.filter((r) => (r.orders_count ?? 0) > 0).length)) : 0,
  }), [rows]);

  const cardapioUrl = (settings?.site_url || window.location.origin).replace(/\/$/, "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-choco-900">Clientes e leads</h1>
        <Button onClick={() => setEditing({ kind: "lead", source: "whatsapp" })}><UserPlus size={16} /> Cadastrar</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Leads" value={totals.leads} sub="ainda não compraram" />
        <Stat label="Clientes" value={totals.clientes} sub="já compraram" tone="accent" />
        <Stat label="Recorrentes" value={totals.recorrentes} sub="2+ pedidos" tone="good" />
        <Stat label="Gasto médio por cliente" value={brl(totals.ltv)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["todos", "leads", "clientes", "recorrentes", "sumidos"] as Seg[]).map((s) => (
          <button key={s} onClick={() => setSeg(s)} className={clsx("rounded-full px-3 py-1.5 text-sm font-semibold capitalize", seg === s ? "bg-vinho-600 text-white" : "bg-white text-choco-700 ring-1 ring-choco-200")}>{s === "sumidos" ? "sumidos (30d+)" : s}</button>
        ))}
        <div className="relative ml-auto">
          <Search size={16} className="absolute left-3 top-3 text-choco-400" />
          <input className="h-10 rounded-xl border border-choco-200 bg-white pl-9 pr-3 text-sm" placeholder="nome, telefone, endereço" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {rows === null ? <Spinner /> : list.length === 0 ? <Empty>Ninguém aqui ainda.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-choco-100 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-choco-50 text-left text-xs uppercase tracking-wide text-choco-500">
              <tr><th className="p-3">Nome</th><th className="p-3">WhatsApp</th><th className="p-3">Tipo</th><th className="p-3 text-right">Pedidos</th><th className="p-3 text-right">Gasto</th><th className="p-3">Última compra</th><th className="p-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-choco-100">
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-rosa-100/40">
                  <td className="p-3"><button className="font-semibold hover:text-vinho-600" onClick={() => setDetail(r)}>{r.name}</button><div className="text-xs text-choco-500">{r.address}</div></td>
                  <td className="p-3 whitespace-nowrap">{formatPhone(r.phone)}</td>
                  <td className="p-3"><Badge className={r.kind === "cliente" ? "bg-emerald-100 text-emerald-800 ring-emerald-300" : "bg-sky-100 text-sky-800 ring-sky-300"}>{r.kind}</Badge> <span className="text-xs text-choco-400">{r.source}</span></td>
                  <td className="p-3 text-right font-bold">{r.orders_count ?? 0}</td>
                  <td className="p-3 text-right">{brl(r.total_spent ?? 0)}</td>
                  <td className="p-3 whitespace-nowrap text-choco-600">{r.last_order_at ? `${dateBR(r.last_order_at)} (${r.days_since_last}d)` : "—"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <a href={waLink(r.phone, r.kind === "lead" ? msgs.lead(r.name, cardapioUrl) : (r.days_since_last ?? 0) >= 30 ? msgs.reativacao(r.name, cardapioUrl) : `Oi ${r.name.split(" ")[0]}! `)} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-[#25D366] hover:bg-emerald-50" title="WhatsApp"><MessageCircle size={18} /></a>
                      <button className="rounded-lg p-2 text-choco-500 hover:bg-choco-100" onClick={() => setEditing(r)} title="Editar"><Pencil size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "Editar cliente" : "Cadastrar lead / cliente"}>
          <div className="space-y-3">
            <Input label="Nome" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Input label="WhatsApp" value={editing.phone ? formatPhone(editing.phone) : ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select label="Tipo" value={editing.kind ?? "lead"} onChange={(e) => setEditing({ ...editing, kind: e.target.value as Customer["kind"] })}><option value="lead">Lead (ainda não comprou)</option><option value="cliente">Cliente</option></Select>
              <Select label="Origem" value={editing.source ?? "whatsapp"} onChange={(e) => setEditing({ ...editing, source: e.target.value })}>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
            </div>
            <Select label="Região de entrega" value={editing.zone_id ?? ""} onChange={(e) => setEditing({ ...editing, zone_id: e.target.value || null })}><option value="">—</option>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select>
            <Input label="Endereço" value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            <Input label="Referência" value={editing.reference ?? ""} onChange={(e) => setEditing({ ...editing, reference: e.target.value })} />
            <Textarea label="Anotações (preferências, aniversário, etc.)" value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            <Button className="w-full" loading={busy} onClick={save}><Plus size={16} /> Salvar</Button>
          </div>
        </Modal>
      )}

      {detail && <CustomerDetail row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function CustomerDetail({ row, onClose }: { row: Row; onClose: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => {
    void supabase.from("orders").select("*").eq("customer_id", row.id).order("scheduled_date", { ascending: false }).then(({ data }) => setOrders((data as Order[]) ?? []));
  }, [row.id]);
  return (
    <Modal open onClose={onClose} title={row.name}>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Pedidos" value={row.orders_count ?? 0} />
        <Stat label="Total gasto" value={brl(row.total_spent ?? 0)} />
        <Stat label="Ticket médio" value={brl(row.avg_ticket ?? 0)} />
      </div>
      <div className="mt-3 text-sm text-choco-700">
        <div>{formatPhone(row.phone)} · {row.source}</div>
        {row.address && <div>{row.address} {row.reference && `(${row.reference})`}</div>}
        {row.notes && <div className="mt-1 rounded-xl bg-amber-50 p-2 text-amber-900">{row.notes}</div>}
      </div>
      <Card title="Histórico" className="mt-3">
        {orders === null ? <Spinner /> : orders.length === 0 ? <Empty>Nenhum pedido ainda.</Empty> : (
          <ul className="divide-y divide-choco-100 text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-1.5">
                <span><b>{o.code}</b> · <span className="capitalize">{dayLabel(o.scheduled_date)}</span></span>
                <span className="flex items-center gap-2">{brl(o.total)} <Badge className={STATUS_COLOR[o.status]}>{statusLabelFor(o.status, o.fulfillment)}</Badge></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Modal>
  );
}
