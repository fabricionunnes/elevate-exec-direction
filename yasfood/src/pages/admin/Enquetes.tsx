import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import type { Poll, PollOption, PollResult } from "@/lib/types";
import { Button, Card, Input, Textarea, Modal, Spinner, Empty, Badge, useToast } from "@/components/ui";

interface Draft { id?: string; question: string; description: string; active: boolean; show_results: boolean; closes_at: string | null; options: { id?: string; label: string }[] }
const empty: Draft = { question: "", description: "", active: true, show_results: true, closes_at: null, options: [{ label: "" }, { label: "" }] };

export default function Enquetes() {
  const toast = useToast();
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [results, setResults] = useState<PollResult[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      supabase.from("polls").select("*").order("created_at", { ascending: false }),
      supabase.from("poll_results").select("*").order("sort_order"),
    ]);
    setPolls((p.data as Poll[]) ?? []);
    setResults((r.data as PollResult[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const edit = async (p: Poll) => {
    const { data } = await supabase.from("poll_options").select("*").eq("poll_id", p.id).order("sort_order");
    setEditing({ id: p.id, question: p.question, description: p.description, active: p.active, show_results: p.show_results, closes_at: p.closes_at, options: ((data as PollOption[]) ?? []).map((o) => ({ id: o.id, label: o.label })) });
  };

  const save = async () => {
    if (!editing) return;
    const opts = editing.options.map((o) => ({ ...o, label: o.label.trim() })).filter((o) => o.label);
    if (!editing.question.trim()) return toast("Escreva a pergunta.", "err");
    if (opts.length < 2) return toast("Pelo menos 2 opções.", "err");
    setBusy(true);
    const base = { question: editing.question.trim(), description: editing.description, active: editing.active, show_results: editing.show_results, closes_at: editing.closes_at || null };
    let pollId = editing.id;
    if (pollId) {
      const { error } = await supabase.from("polls").update(base).eq("id", pollId);
      if (error) { setBusy(false); return toast(friendlyError(error), "err"); }
    } else {
      const { data, error } = await supabase.from("polls").insert(base).select("id").single();
      if (error) { setBusy(false); return toast(friendlyError(error), "err"); }
      pollId = (data as { id: string }).id;
    }
    // opções: atualiza existentes, cria novas, remove as que saíram (votos das removidas somem)
    const { data: existing } = await supabase.from("poll_options").select("id").eq("poll_id", pollId);
    const keep = new Set(opts.filter((o) => o.id).map((o) => o.id));
    const toDelete = ((existing as { id: string }[]) ?? []).filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (toDelete.length) await supabase.from("poll_options").delete().in("id", toDelete);
    for (let i = 0; i < opts.length; i++) {
      const o = opts[i];
      if (o.id) await supabase.from("poll_options").update({ label: o.label, sort_order: i }).eq("id", o.id);
      else await supabase.from("poll_options").insert({ poll_id: pollId, label: o.label, sort_order: i });
    }
    setBusy(false);
    toast("Enquete salva.");
    setEditing(null);
    void load();
  };

  const remove = async (p: Poll) => {
    if (!confirm(`Excluir a enquete "${p.question}" e seus votos?`)) return;
    await supabase.from("polls").delete().eq("id", p.id);
    void load();
  };

  const toggle = async (p: Poll) => {
    await supabase.from("polls").update({ active: !p.active }).eq("id", p.id);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-choco-900">Enquetes</h1>
        <Button onClick={() => setEditing({ ...empty, options: [{ label: "" }, { label: "" }] })}><Plus size={16} /> Nova enquete</Button>
      </div>
      <p className="text-sm text-choco-600">A enquete ativa mais recente aparece no cardápio. Um voto por aparelho; o cliente pode trocar o voto. Use pra testar sabor novo, dia de entrega, tamanho…</p>

      {polls === null ? <Spinner /> : polls.length === 0 ? <Empty>Nenhuma enquete ainda.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {polls.map((p) => {
            const rs = results.filter((r) => r.poll_id === p.id);
            const total = rs.reduce((a, r) => a + r.votes, 0);
            return (
              <Card key={p.id} className={!p.active ? "opacity-70" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold">{p.question}</h3>
                  <Badge className={p.active ? "bg-emerald-100 text-emerald-800 ring-emerald-300" : "bg-neutral-100 text-neutral-600 ring-neutral-300"}>{p.active ? "ativa" : "inativa"}</Badge>
                </div>
                <div className="mt-2 space-y-1">
                  {rs.map((r) => {
                    const pct = total ? Math.round((r.votes / total) * 100) : 0;
                    return (
                      <div key={r.option_id} className="text-sm">
                        <div className="flex justify-between"><span>{r.label}</span><span className="text-choco-600">{r.votes} · {pct}%</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-choco-100"><div className="h-full bg-vinho-500" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-choco-500">{total} voto(s){p.closes_at ? ` · encerra em ${p.closes_at.split("-").reverse().join("/")}` : ""}</div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => edit(p)}><Pencil size={14} /> Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.active ? "Desativar" : "Ativar"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 size={14} /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "Editar enquete" : "Nova enquete"}>
          <div className="space-y-3">
            <Input label="Pergunta" value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} placeholder="Ex.: Qual sabor você quer ver no cardápio?" />
            <Textarea label="Descrição (opcional)" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <div>
              <span className="mb-1 block text-sm font-medium text-choco-800">Opções</span>
              <div className="space-y-2">
                {editing.options.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="h-10 flex-1 rounded-xl border border-choco-200 bg-white px-3 text-sm" value={o.label} placeholder={`Opção ${i + 1}`} onChange={(e) => setEditing({ ...editing, options: editing.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                    <button className="px-2 text-choco-400 hover:text-red-600" onClick={() => setEditing({ ...editing, options: editing.options.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setEditing({ ...editing, options: [...editing.options, { label: "" }] })}><Plus size={14} /> opção</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Encerra em (opcional)" type="date" value={editing.closes_at ?? ""} onChange={(e) => setEditing({ ...editing, closes_at: e.target.value || null })} />
              <div className="space-y-2 pt-6 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> ativa</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editing.show_results} onChange={(e) => setEditing({ ...editing, show_results: e.target.checked })} /> mostrar resultado pro cliente</label>
              </div>
            </div>
            <Button className="w-full" loading={busy} onClick={save}>Salvar enquete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
