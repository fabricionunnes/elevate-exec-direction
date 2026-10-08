import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Send, EyeOff, Eye } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { dateTimeBR, formatPhone } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import type { Review } from "@/lib/types";
import { Button, Card, Input, Stars, Stat, Spinner, Empty, useToast } from "@/components/ui";

interface Pending { order_id: string; code: string; customer_name: string; customer_phone: string; due_at: string; link: string; message: string }

export default function Avaliacoes() {
  const toast = useToast();
  const { settings, reload } = useSettings();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      supabase.from("reviews").select("*").order("created_at", { ascending: false }),
      supabase.rpc("pending_review_requests"),
    ]);
    setReviews((r.data as Review[]) ?? []);
    setPending((p.data as Pending[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const avg = reviews?.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews?.filter((r) => r.rating === n).length ?? 0 }));

  const markSent = async (id: string) => {
    const { error } = await supabase.rpc("mark_review_request_sent", { p_order_id: id });
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  const saveReply = async (r: Review) => {
    const { error } = await supabase.from("reviews").update({ reply: reply[r.id] ?? r.reply }).eq("id", r.id);
    if (error) return toast(friendlyError(error), "err");
    toast("Resposta publicada.");
    void load();
  };

  const toggle = async (r: Review) => {
    await supabase.from("reviews").update({ approved: !r.approved }).eq("id", r.id);
    void load();
  };

  const patchSettings = async (p: Record<string, unknown>) => {
    const { error } = await supabase.from("settings").update(p).eq("id", 1);
    if (error) return toast(friendlyError(error), "err");
    toast("Salvo.");
    void reload();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-choco-900">Avaliações</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nota média" value={reviews?.length ? avg.toFixed(1) : "—"} sub={`${reviews?.length ?? 0} avaliações`} tone="accent" />
        <Stat label="5 estrelas" value={dist[0].c} tone="good" />
        <Stat label="3 ou menos" value={dist[2].c + dist[3].c + dist[4].c} tone={dist[2].c + dist[3].c + dist[4].c > 0 ? "bad" : "default"} sub="vale ligar e entender" />
        <Stat label="Pra pedir avaliação" value={pending.length} sub="entregues e na hora" />
      </div>

      {settings && (
        <Card title="Pedido automático de avaliação">
          <p className="mb-3 text-sm text-choco-600">Depois de marcar <b>Entregue</b>, o sistema agenda o pedido de avaliação. Com webhook configurado (N8N + WhatsApp API), o envio é automático. Sem webhook, a fila aparece aqui pra você mandar com um toque.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.review_auto_enabled} onChange={(e) => patchSettings({ review_auto_enabled: e.target.checked })} /> automático ligado</label>
            <Input label="Horas depois da entrega" type="number" min={0} defaultValue={settings.review_delay_hours} onBlur={(e) => Number(e.target.value) !== settings.review_delay_hours && patchSettings({ review_delay_hours: Number(e.target.value) })} />
            <Input label="Webhook (N8N)" placeholder="https://n8n.../webhook/avaliacao" defaultValue={settings.review_webhook_url} onBlur={(e) => e.target.value !== settings.review_webhook_url && patchSettings({ review_webhook_url: e.target.value.trim() })} />
          </div>
          <div className="mt-3"><Input label="Mensagem ({nome}, {link} e {codigo} são substituídos)" defaultValue={settings.review_message} onBlur={(e) => e.target.value !== settings.review_message && patchSettings({ review_message: e.target.value })} /></div>
        </Card>
      )}

      <Card title={`Fila de envio (${pending.length})`}>
        {pending.length === 0 ? <Empty>Ninguém na fila. Pedidos entregues entram aqui após o prazo configurado.</Empty> : (
          <ul className="divide-y divide-choco-100 text-sm">
            {pending.map((p) => (
              <li key={p.order_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><b>{p.customer_name}</b> · {p.code} · {formatPhone(p.customer_phone)} <span className="text-xs text-choco-400">desde {dateTimeBR(p.due_at)}</span></span>
                <span className="flex gap-2">
                  <a href={waLink(p.customer_phone, p.message)} target="_blank" rel="noreferrer" onClick={() => markSent(p.order_id)}><Button variant="wa" size="sm"><MessageCircle size={14} /> Enviar no Whats</Button></a>
                  <Button variant="ghost" size="sm" onClick={() => markSent(p.order_id)}><Send size={14} /> já enviei</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Todas as avaliações">
        {reviews === null ? <Spinner /> : reviews.length === 0 ? <Empty>Ainda sem avaliações.</Empty> : (
          <ul className="divide-y divide-choco-100">
            {reviews.map((r) => (
              <li key={r.id} className={r.approved ? "py-3" : "py-3 opacity-60"}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">{r.customer_name}</span>
                  <span className="flex items-center gap-2"><Stars value={r.rating} size={16} /><button onClick={() => toggle(r)} className="text-choco-400 hover:text-choco-800" title={r.approved ? "Ocultar do site" : "Mostrar no site"}>{r.approved ? <Eye size={16} /> : <EyeOff size={16} />}</button></span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-choco-700">“{r.comment}”</p>}
                <div className="mt-2 flex gap-2">
                  <input className="h-9 flex-1 rounded-lg border border-choco-200 px-2 text-sm" placeholder="Responder publicamente…" value={reply[r.id] ?? r.reply} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} />
                  <Button size="sm" variant="outline" onClick={() => saveReply(r)}>Responder</Button>
                </div>
                <div className="mt-1 text-[11px] text-choco-400">{dateTimeBR(r.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
