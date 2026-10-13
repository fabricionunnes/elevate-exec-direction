// Sugestões, reclamações e elogios que chegam pelo site ("Fale com a Yas").
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Check, Eye, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { dateTimeBR, formatPhone } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import type { Feedback } from "@/lib/types";
import { Button, Badge, Stat, Spinner, Empty, Textarea, useToast } from "@/components/ui";

const KIND: Record<Feedback["kind"], { label: string; cor: string }> = {
  sugestao: { label: "Sugestão", cor: "bg-sky-100 text-sky-800 ring-sky-300" },
  reclamacao: { label: "Reclamação", cor: "bg-red-100 text-red-800 ring-red-300" },
  elogio: { label: "Elogio", cor: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
};
const STATUS: Record<Feedback["status"], string> = { novo: "Nova", lido: "Lida", resolvido: "Resolvida" };

type Filtro = "novas" | "reclamacoes" | "todas" | "resolvidas";

export default function Sugestoes() {
  const toast = useToast();
  const [rows, setRows] = useState<Feedback[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("novas");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.from("feedback").select("*").order("created_at", { ascending: false });
    setRows((data as Feedback[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const all = rows ?? [];
    if (filtro === "novas") return all.filter((r) => r.status === "novo");
    if (filtro === "reclamacoes") return all.filter((r) => r.kind === "reclamacao" && r.status !== "resolvido");
    if (filtro === "resolvidas") return all.filter((r) => r.status === "resolvido");
    return all;
  }, [rows, filtro]);

  const setStatus = async (r: Feedback, status: Feedback["status"]) => {
    const patch: Partial<Feedback> = { status };
    if (status === "lido" && !r.read_at) patch.read_at = new Date().toISOString();
    if (status === "resolvido") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("feedback").update(patch).eq("id", r.id);
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  const saveNotes = async (r: Feedback) => {
    const { error } = await supabase.from("feedback").update({ notes: notes[r.id] ?? r.notes }).eq("id", r.id);
    if (error) return toast(friendlyError(error), "err");
    toast("Anotação salva.");
    void load();
  };

  const remove = async (r: Feedback) => {
    if (!window.confirm("Apagar essa mensagem? Não dá pra desfazer.")) return;
    const { error } = await supabase.from("feedback").delete().eq("id", r.id);
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  const novas = rows?.filter((r) => r.status === "novo").length ?? 0;
  const recl = rows?.filter((r) => r.kind === "reclamacao" && r.status !== "resolvido").length ?? 0;
  const elogios = rows?.filter((r) => r.kind === "elogio").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-choco-900">Sugestões e reclamações</h1>
        <a href="/fale" target="_blank" rel="noreferrer" className="text-sm font-semibold text-vinho-600 underline">Ver a página do site</a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Novas" value={novas} tone={novas > 0 ? "accent" : "default"} sub="ainda não lidas" />
        <Stat label="Reclamações abertas" value={recl} tone={recl > 0 ? "bad" : "default"} sub="responder em até 24 h" />
        <Stat label="Elogios" value={elogios} tone="good" />
        <Stat label="Total" value={rows?.length ?? 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["novas", "reclamacoes", "todas", "resolvidas"] as Filtro[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)} className={clsx("rounded-full px-3 py-1.5 text-sm font-semibold capitalize", filtro === f ? "bg-vinho-600 text-white" : "bg-white text-choco-700 ring-1 ring-choco-200")}>
            {f === "reclamacoes" ? "reclamações abertas" : f}
          </button>
        ))}
      </div>

      {rows === null ? <Spinner /> : list.length === 0 ? <Empty>Nada por aqui.</Empty> : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className={clsx("rounded-2xl border bg-white p-4 shadow-card", r.status === "novo" ? "border-vinho-300" : "border-choco-100")}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={clsx("ring-1 ring-inset", KIND[r.kind].cor)}>{KIND[r.kind].label}</Badge>
                <span className="font-bold">{r.anonymous || (!r.name && !r.phone) ? "Anônimo" : r.name || "Sem nome"}</span>
                {r.phone && <span className="text-sm text-choco-600">{formatPhone(r.phone)}</span>}
                <span className="ml-auto text-xs text-choco-400">{dateTimeBR(r.created_at)} · {STATUS[r.status]}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-choco-800">{r.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.phone && (
                  <a href={waLink(r.phone, `Oi${r.name ? ` ${r.name.split(" ")[0]}` : ""}! Aqui é a Yasmim, da Yas Delícias. Recebi sua ${KIND[r.kind].label.toLowerCase()} pelo site e quero te responder.`)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="wa"><MessageCircle size={14} /> Responder no WhatsApp</Button>
                  </a>
                )}
                {r.status === "novo" && <Button size="sm" variant="outline" onClick={() => void setStatus(r, "lido")}><Eye size={14} /> Marcar como lida</Button>}
                {r.status !== "resolvido" && <Button size="sm" variant="outline" onClick={() => void setStatus(r, "resolvido")}><Check size={14} /> Resolvida</Button>}
                {r.status === "resolvido" && <Button size="sm" variant="ghost" onClick={() => void setStatus(r, "lido")}>Reabrir</Button>}
                <Button size="sm" variant="ghost" onClick={() => void remove(r)} title="Apagar"><Trash2 size={14} /></Button>
              </div>
              <div className="mt-3">
                <Textarea label="Anotação interna (o que você fez, o que combinou)" rows={2} value={notes[r.id] ?? r.notes} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} onBlur={() => { if ((notes[r.id] ?? r.notes) !== r.notes) void saveNotes(r); }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
