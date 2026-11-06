// E-mail dentro do Nexus (Fabrício, 05/11/2026: "uma plataforma mais bonita pra ter isso").
// Caixa do Gmail do próprio usuário, sincronizada pelo gmail-sync (cron a cada minuto + realtime).
// Três colunas: pastas, lista por conversa, leitura. Compor, responder, encaminhar, anexos, busca
// e vínculo com o lead do CRM pelo e-mail do remetente.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// tabelas mail_* ainda não estão nos tipos gerados do Supabase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { startGoogleCalendarConnection } from "@/lib/googleCalendarOAuth";
import { toast } from "sonner";
import { format, isToday, isThisYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Inbox, Star, Send, Trash2, AlertOctagon, Archive, Mail, MailOpen, Reply, ReplyAll, Forward, Paperclip,
  Search, RefreshCw, Loader2, PenSquare, X, ChevronLeft, Tag, Download, UserRound, ExternalLink, Plug,
} from "lucide-react";

type Addr = { name: string; email: string };
type Msg = {
  id: string; account_id: string; gmail_id: string; thread_id: string; label_ids: string[];
  from_name: string | null; from_email: string | null; to_list: Addr[]; cc_list: Addr[]; bcc_list: Addr[];
  subject: string | null; snippet: string | null; internal_date: string; is_unread: boolean; is_starred: boolean;
  is_sent: boolean; has_attachments: boolean; attachments: { attachmentId: string | null; filename: string; mimeType: string; size: number; contentId: string | null; inline?: boolean }[];
  body_html: string | null; body_text: string | null; body_loaded: boolean; message_id_header: string | null; references_header: string | null;
};
type Label = { gmail_label_id: string; name: string; type: string | null; color: string | null };
type Account = { id: string; email: string; backfill_done: boolean; last_sync_at: string | null; last_error: string | null };

const NAVY = "#0D2B5E";
const PASTAS: { key: string; nome: string; icon: typeof Inbox }[] = [
  { key: "INBOX", nome: "Entrada", icon: Inbox },
  { key: "STARRED", nome: "Com estrela", icon: Star },
  { key: "SENT", nome: "Enviados", icon: Send },
  { key: "DRAFT", nome: "Rascunhos", icon: PenSquare },
  { key: "SPAM", nome: "Spam", icon: AlertOctagon },
  { key: "TRASH", nome: "Lixeira", icon: Trash2 },
];
const SISTEMA = new Set(["INBOX", "STARRED", "SENT", "DRAFT", "SPAM", "TRASH", "UNREAD", "IMPORTANT", "CHAT", "CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "CATEGORY_FORUMS"]);

const iniciais = (s: string) => (s || "?").replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
const corDe = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 45% 42%)`; };
const quando = (iso: string) => { const d = new Date(iso); return isToday(d) ? format(d, "HH:mm") : isThisYear(d) ? format(d, "d 'de' MMM", { locale: ptBR }) : format(d, "dd/MM/yy"); };
const quandoLongo = (iso: string) => format(new Date(iso), "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
const nomeDe = (m: Msg) => m.from_name || m.from_email || "?";
const tamanho = (n: number) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// HTML do e-mail numa sandbox: sem script, links abrem fora, largura contida
function docDoEmail(m: Msg): string {
  const corpo = m.body_html || (m.body_text ? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(m.body_text)}</pre>` : `<p style="color:#6b7280">${escapeHtml(m.snippet || "")}</p>`);
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>body{margin:0;padding:16px 20px;font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;word-break:break-word}img{max-width:100%;height:auto}blockquote{border-left:3px solid #e5e7eb;margin:8px 0;padding-left:12px;color:#6b7280}a{color:#0D2B5E}table{max-width:100%}</style>
</head><body>${corpo}</body></html>`;
}

export default function CRMEmailPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [precisaConectar, setPrecisaConectar] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [pasta, setPasta] = useState<string>(params.get("pasta") || "INBOX");
  const [busca, setBusca] = useState("");
  const [buscaIds, setBuscaIds] = useState<string[] | null>(null);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [naoLidas, setNaoLidas] = useState<Record<string, number>>({});
  const [threadSel, setThreadSel] = useState<string | null>(params.get("thread"));
  const [thread, setThread] = useState<Msg[]>([]);
  const [carregandoThread, setCarregandoThread] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [compor, setCompor] = useState<null | { modo: "novo" | "responder" | "todos" | "encaminhar"; base?: Msg }>(null);
  const [leadDoRemetente, setLeadDoRemetente] = useState<{ id: string; name: string; company: string | null; stage: string | null } | null>(null);
  const [mobileLendo, setMobileLendo] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const chamar = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("gmail-sync", { body });
    if (error) {
      // invoke esconde o corpo do erro; tenta ler
      let msg = error.message || "Erro";
      try { const ctx = (error as any).context; if (ctx?.json) { const j = await ctx.json(); msg = j.error || msg; if (j.needsAuth || j.needsConnect) setPrecisaConectar(true); } } catch { /* nada */ }
      throw new Error(msg);
    }
    if (data?.needsAuth || data?.needsConnect) setPrecisaConectar(true);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  // Estado da caixa (e conexão automática ao voltar do Google)
  useEffect(() => {
    (async () => {
      try {
        const st = await chamar({ action: "status" });
        if (st.account) { setAccount(st.account); return; }
        // sem caixa: tenta conectar (funciona se o token do Google já tem o escopo do Gmail)
        try { const c = await chamar({ action: "connect" }); setAccount(c.account); }
        catch { setAccount(null); setPrecisaConectar(true); }
      } catch { setAccount(null); setPrecisaConectar(true); }
    })();
  }, [chamar]);

  const carregarLabels = useCallback(async (acc: Account) => {
    const { data } = await db.from("mail_labels").select("gmail_label_id, name, type, color").eq("account_id", acc.id).order("name");
    setLabels((data as Label[]) || []);
    const chaves = ["INBOX", "SPAM", "DRAFT", ...((data as Label[]) || []).filter((l) => l.type === "user").map((l) => l.gmail_label_id)];
    const contagem: Record<string, number> = {};
    await Promise.all(chaves.map(async (k) => {
      const { count } = await db.from("mail_messages").select("id", { count: "exact", head: true }).eq("account_id", acc.id).eq("is_unread", true).contains("label_ids", [k]).not("label_ids", "cs", "{TRASH}");
      contagem[k] = count || 0;
    }));
    setNaoLidas(contagem);
  }, []);

  const carregarLista = useCallback(async (acc: Account) => {
    setCarregando(true);
    let q = db.from("mail_messages")
      .select("id, account_id, gmail_id, thread_id, label_ids, from_name, from_email, to_list, subject, snippet, internal_date, is_unread, is_starred, is_sent, has_attachments")
      .eq("account_id", acc.id).order("internal_date", { ascending: false }).limit(400);
    if (buscaIds) q = buscaIds.length ? q.in("gmail_id", buscaIds) : q.in("gmail_id", ["-"]);
    else if (pasta === "TRASH" || pasta === "SPAM") q = q.contains("label_ids", [pasta]);
    else q = q.contains("label_ids", [pasta]).not("label_ids", "cs", "{TRASH}").not("label_ids", "cs", "{SPAM}");
    const { data } = await q;
    setMensagens((data as Msg[]) || []);
    setCarregando(false);
  }, [pasta, buscaIds]);

  useEffect(() => { if (account) { carregarLabels(account); carregarLista(account); } }, [account, carregarLabels, carregarLista]);

  // Realtime: qualquer mudança na própria caixa recarrega a lista e os contadores
  useEffect(() => {
    if (!account) return;
    const ch = supabase.channel(`mail-${account.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mail_messages", filter: `account_id=eq.${account.id}` }, () => { carregarLista(account); carregarLabels(account); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mail_accounts", filter: `id=eq.${account.id}` }, (p) => setAccount(p.new as Account))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [account, carregarLista, carregarLabels]);

  // Conversas: a mensagem mais recente de cada thread + quantidade
  const conversas = useMemo(() => {
    const porThread = new Map<string, { ultima: Msg; qtd: number; naoLida: boolean; estrela: boolean }>();
    for (const m of mensagens) {
      const t = porThread.get(m.thread_id);
      if (!t) porThread.set(m.thread_id, { ultima: m, qtd: 1, naoLida: m.is_unread, estrela: m.is_starred });
      else { t.qtd++; t.naoLida = t.naoLida || m.is_unread; t.estrela = t.estrela || m.is_starred; if (m.internal_date > t.ultima.internal_date) t.ultima = m; }
    }
    return [...porThread.values()].sort((a, b) => b.ultima.internal_date.localeCompare(a.ultima.internal_date));
  }, [mensagens]);

  // Abrir conversa: carrega as mensagens da thread, corpo sob demanda, marca lida
  const abrirThread = useCallback(async (threadId: string) => {
    if (!account) return;
    setThreadSel(threadId); setMobileLendo(true);
    setParams((p) => { p.set("thread", threadId); return p; }, { replace: true });
    setCarregandoThread(true);
    const { data } = await db.from("mail_messages").select("*").eq("account_id", account.id).eq("thread_id", threadId).order("internal_date", { ascending: true });
    let msgs = (data as Msg[]) || [];
    setThread(msgs);
    // corpos que faltam (mais recente primeiro)
    const semCorpo = [...msgs].reverse().filter((m) => !m.body_loaded).slice(0, 5);
    for (const m of semCorpo) {
      try { const r = await chamar({ action: "message", gmail_id: m.gmail_id }); if (r?.message) msgs = msgs.map((x) => (x.id === m.id ? (r.message as Msg) : x)); setThread([...msgs]); } catch { /* fica com o resumo */ }
    }
    setCarregandoThread(false);
    const naoLidas = msgs.filter((m) => m.is_unread).map((m) => m.gmail_id);
    if (naoLidas.length) {
      setMensagens((prev) => prev.map((m) => (naoLidas.includes(m.gmail_id) ? { ...m, is_unread: false } : m)));
      chamar({ action: "modify", gmail_ids: naoLidas, remove: ["UNREAD"] }).catch(() => {});
    }
    // lead do CRM pelo remetente da última mensagem recebida
    const ultimaRecebida = [...msgs].reverse().find((m) => !m.is_sent) || msgs[msgs.length - 1];
    const email = ultimaRecebida?.from_email;
    if (email && !email.endsWith("@universidadevendas.com.br")) {
      const { data: lead } = await db.from("crm_leads").select("id, name, company, stage:crm_stages(name)").ilike("email", email).limit(1).maybeSingle();
      setLeadDoRemetente(lead ? { id: lead.id, name: lead.name, company: (lead as any).company, stage: (lead as any).stage?.name || null } : null);
    } else setLeadDoRemetente(null);
  }, [account, chamar, setParams]);

  useEffect(() => { if (account && threadSel && thread.length === 0) abrirThread(threadSel); /* eslint-disable-next-line */ }, [account]);

  const modificar = async (ids: string[], add: string[], remove: string[], otimista?: (m: Msg) => Msg) => {
    if (otimista) { setMensagens((prev) => prev.map((m) => (ids.includes(m.gmail_id) ? otimista(m) : m))); setThread((prev) => prev.map((m) => (ids.includes(m.gmail_id) ? otimista(m) : m))); }
    try { await chamar({ action: "modify", gmail_ids: ids, add, remove }); } catch (e) { toast.error((e as Error).message); }
  };
  const idsDaThread = (threadId: string) => mensagens.filter((m) => m.thread_id === threadId).map((m) => m.gmail_id);
  const arquivar = (threadId: string) => { modificar(idsDaThread(threadId), [], ["INBOX"]); setMensagens((p) => p.filter((m) => m.thread_id !== threadId)); if (threadSel === threadId) fecharThread(); toast.success("Arquivado"); };
  const lixeira = (threadId: string) => { modificar(idsDaThread(threadId), ["TRASH"], ["INBOX"]); setMensagens((p) => p.filter((m) => m.thread_id !== threadId)); if (threadSel === threadId) fecharThread(); toast.success("Movido pra lixeira"); };
  const estrela = (m: Msg) => modificar([m.gmail_id], m.is_starred ? [] : ["STARRED"], m.is_starred ? ["STARRED"] : [], (x) => ({ ...x, is_starred: !m.is_starred }));
  const marcarNaoLida = (threadId: string) => { const ids = idsDaThread(threadId); modificar(ids.slice(-1), ["UNREAD"], [], (x) => ({ ...x, is_unread: true })); fecharThread(); };
  const fecharThread = () => { setThreadSel(null); setThread([]); setMobileLendo(false); setLeadDoRemetente(null); setParams((p) => { p.delete("thread"); return p; }, { replace: true }); };

  const sincronizar = async () => {
    setSincronizando(true);
    try { await chamar({ action: "sync-me" }); if (account) { await carregarLista(account); await carregarLabels(account); } }
    catch (e) { toast.error((e as Error).message); } finally { setSincronizando(false); }
  };

  const buscar = async (texto: string) => {
    const q = texto.trim();
    if (!q) { setBuscaIds(null); return; }
    setCarregando(true);
    try { const r = await chamar({ action: "search", q }); setBuscaIds(r.gmail_ids || []); }
    catch (e) { toast.error((e as Error).message); setCarregando(false); }
  };

  const baixarAnexo = async (m: Msg, a: Msg["attachments"][number]) => {
    if (!a.attachmentId) return;
    const t = toast.loading(`Baixando ${a.filename}...`);
    try {
      const r = await chamar({ action: "attachment", gmail_id: m.gmail_id, attachment_id: a.attachmentId });
      const bin = atob(String(r.data).replace(/-/g, "+").replace(/_/g, "/"));
      const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: a.mimeType || "application/octet-stream" }));
      const el = document.createElement("a"); el.href = url; el.download = a.filename; el.click(); URL.revokeObjectURL(url);
      toast.success("Anexo baixado", { id: t });
    } catch (e) { toast.error((e as Error).message, { id: t }); }
  };

  const conectar = async () => {
    try { await startGoogleCalendarConnection("/crm/email"); } catch (e) { toast.error((e as Error).message); }
  };

  // ── Estados vazios ──
  if (account === undefined) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!account || precisaConectar) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-xl border bg-card p-8 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "#0D2B5E14" }}><Mail className="h-7 w-7" style={{ color: NAVY }} /></div>
        <h2 className="text-xl font-semibold" style={{ color: NAVY }}>Seu e-mail dentro do Nexus</h2>
        <p className="text-sm text-muted-foreground">Conecte sua conta Google uma vez. O Nexus passa a mostrar sua caixa de entrada aqui, com atualização automática, e você responde sem sair do sistema.</p>
        <Button onClick={conectar} className="gap-2"><Plug className="h-4 w-4" /> Conectar meu Gmail</Button>
        <p className="text-[11px] text-muted-foreground">Se você já tinha o Google conectado pra agenda, vai só confirmar a permissão do Gmail.</p>
      </div>
    );
  }

  const ultimaThread = thread[thread.length - 1];
  const assuntoThread = thread[0]?.subject || conversas.find((c) => c.ultima.thread_id === threadSel)?.ultima.subject || "";
  const labelsUsuario = labels.filter((l) => l.type === "user" && !SISTEMA.has(l.gmail_label_id));

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-7.5rem)] min-h-[520px] rounded-xl border bg-card overflow-hidden">
        {/* Pastas */}
        <aside className={cn("w-56 shrink-0 border-r flex flex-col", mobileLendo ? "hidden lg:flex" : "hidden md:flex")}>
          <div className="p-3">
            <Button className="w-full gap-2 shadow-sm" style={{ background: NAVY }} onClick={() => setCompor({ modo: "novo" })}><PenSquare className="h-4 w-4" /> Escrever</Button>
          </div>
          <ScrollArea className="flex-1">
            <nav className="px-2 pb-2 space-y-0.5">
              {PASTAS.map((p) => {
                const Icon = p.icon; const ativo = pasta === p.key && !buscaIds; const n = naoLidas[p.key] || 0;
                return (
                  <button key={p.key} onClick={() => { setBusca(""); setBuscaIds(null); setPasta(p.key); setParams((q) => { q.set("pasta", p.key); return q; }, { replace: true }); fecharThread(); }}
                    className={cn("w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors", ativo ? "font-semibold" : "hover:bg-muted/60 text-foreground/80")}
                    style={ativo ? { background: "#0D2B5E12", color: NAVY } : undefined}>
                    <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-left truncate">{p.nome}</span>
                    {n > 0 && <span className="text-[11px] font-semibold tabular-nums rounded-full px-1.5 py-0.5 text-white" style={{ background: NAVY }}>{n}</span>}
                  </button>
                );
              })}
              {labelsUsuario.length > 0 && <p className="px-2.5 pt-3 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Marcadores</p>}
              {labelsUsuario.map((l) => {
                const ativo = pasta === l.gmail_label_id && !buscaIds; const n = naoLidas[l.gmail_label_id] || 0;
                return (
                  <button key={l.gmail_label_id} onClick={() => { setBusca(""); setBuscaIds(null); setPasta(l.gmail_label_id); fecharThread(); }}
                    className={cn("w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors", ativo ? "font-semibold" : "hover:bg-muted/60 text-foreground/80")}
                    style={ativo ? { background: "#0D2B5E12", color: NAVY } : undefined}>
                    <Tag className="h-3.5 w-3.5 shrink-0" style={{ color: l.color || undefined }} /><span className="flex-1 text-left truncate">{l.name}</span>
                    {n > 0 && <span className="text-[11px] tabular-nums text-muted-foreground">{n}</span>}
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
          <div className="border-t p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="truncate font-medium text-foreground/80">{account.email}</p>
            <p>{account.backfill_done ? "Caixa sincronizada" : "Carregando histórico (90 dias)..."}</p>
            {account.last_error && <p className="text-destructive truncate" title={account.last_error}>Erro: {account.last_error}</p>}
          </div>
        </aside>

        {/* Lista */}
        <section className={cn("w-full md:w-[380px] lg:w-[420px] shrink-0 border-r flex flex-col min-w-0", mobileLendo && "hidden lg:flex")}>
          <div className="p-2.5 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") buscar(busca); if (e.key === "Escape") { setBusca(""); setBuscaIds(null); } }}
                placeholder="Buscar no Gmail (de:, assunto:, has:attachment...)" className="pl-8 h-9" />
              {buscaIds && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => { setBusca(""); setBuscaIds(null); }}><X className="h-4 w-4" /></button>}
            </div>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={sincronizar} disabled={sincronizando}><RefreshCw className={cn("h-4 w-4", sincronizando && "animate-spin")} /></Button>
            </TooltipTrigger><TooltipContent>Sincronizar agora</TooltipContent></Tooltip>
            <Button size="icon" className="h-9 w-9 md:hidden" style={{ background: NAVY }} onClick={() => setCompor({ modo: "novo" })}><PenSquare className="h-4 w-4" /></Button>
          </div>
          <ScrollArea className="flex-1">
            {carregando && conversas.length === 0 ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : conversas.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {buscaIds ? "Nada encontrado." : !account.backfill_done ? "Carregando sua caixa... os e-mails aparecem aqui em instantes." : "Nenhum e-mail aqui."}
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {conversas.map(({ ultima: m, qtd, naoLida, estrela: est }) => {
                  const sel = threadSel === m.thread_id;
                  const quem = m.is_sent ? `Para: ${(m.to_list || []).map((a) => a.name || a.email).join(", ") || "?"}` : nomeDe(m);
                  return (
                    <li key={m.thread_id}>
                      <button onClick={() => abrirThread(m.thread_id)} className={cn("w-full text-left px-3 py-2.5 flex gap-3 transition-colors group", sel ? "bg-muted" : "hover:bg-muted/50", naoLida && !sel && "bg-[#0D2B5E]/[0.04]")}>
                        <Avatar className="h-9 w-9 shrink-0 mt-0.5"><AvatarFallback className="text-xs font-semibold text-white" style={{ background: corDe(m.from_email || quem) }}>{iniciais(m.is_sent ? (m.to_list?.[0]?.name || m.to_list?.[0]?.email || "?") : quem)}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("truncate text-sm flex-1", naoLida ? "font-semibold" : "font-medium text-foreground/80")}>{quem}</span>
                            {qtd > 1 && <span className="text-[10px] text-muted-foreground tabular-nums">{qtd}</span>}
                            <span className={cn("text-[11px] tabular-nums shrink-0", naoLida ? "font-semibold" : "text-muted-foreground")} style={naoLida ? { color: NAVY } : undefined}>{quando(m.internal_date)}</span>
                          </div>
                          <p className={cn("truncate text-[13px]", naoLida ? "font-medium" : "text-foreground/80")}>{m.subject || "(sem assunto)"}</p>
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs text-muted-foreground flex-1">{m.snippet}</p>
                            {m.has_attachments && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                            <button onClick={(e) => { e.stopPropagation(); estrela(m); }} className={cn("shrink-0", est ? "text-amber-500" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100")}><Star className={cn("h-3.5 w-3.5", est && "fill-current")} /></button>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </section>

        {/* Leitura */}
        <section className={cn("flex-1 min-w-0 flex flex-col", !mobileLendo && "hidden lg:flex")}>
          {!threadSel ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MailOpen className="h-10 w-10 opacity-30" /><p className="text-sm">Escolha uma conversa</p>
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-2.5 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={fecharThread}><ChevronLeft className="h-4 w-4" /></Button>
                <h2 className="flex-1 min-w-0 truncate font-semibold" style={{ color: NAVY }}>{assuntoThread || "(sem assunto)"}</h2>
                {leadDoRemetente && (
                  <button onClick={() => navigate(`/crm/leads/${leadDoRemetente.id}`)} className="hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted mr-2" title="Abrir o lead no CRM">
                    <UserRound className="h-3.5 w-3.5" style={{ color: NAVY }} /><span className="font-medium truncate max-w-[180px]">{leadDoRemetente.name}</span>
                    {leadDoRemetente.stage && <Badge variant="secondary" className="text-[10px]">{leadDoRemetente.stage}</Badge>}<ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                {ultimaThread && !["TRASH"].includes(pasta) && (
                  <>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => arquivar(ultimaThread.thread_id)}><Archive className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Arquivar</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => marcarNaoLida(ultimaThread.thread_id)}><Mail className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Marcar como não lida</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => lixeira(ultimaThread.thread_id)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Lixeira</TooltipContent></Tooltip>
                  </>
                )}
              </div>
              <ScrollArea className="flex-1 bg-muted/30">
                <div className="p-3 space-y-3 max-w-5xl">
                  {thread.map((m, i) => {
                    const aberto = i === thread.length - 1 || thread.length <= 3;
                    return <Mensagem key={m.id} m={m} abertoInicial={aberto} onBaixar={(a) => baixarAnexo(m, a)} onEstrela={() => estrela(m)}
                      onResponder={() => setCompor({ modo: "responder", base: m })} onResponderTodos={() => setCompor({ modo: "todos", base: m })} onEncaminhar={() => setCompor({ modo: "encaminhar", base: m })} />;
                  })}
                  {carregandoThread && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
                </div>
              </ScrollArea>
              {ultimaThread && (
                <div className="border-t p-2.5 flex gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => setCompor({ modo: "responder", base: ultimaThread })}><Reply className="h-4 w-4" /> Responder</Button>
                  <Button variant="outline" className="gap-2" onClick={() => setCompor({ modo: "todos", base: ultimaThread })}><ReplyAll className="h-4 w-4" /> Responder a todos</Button>
                  <Button variant="outline" className="gap-2" onClick={() => setCompor({ modo: "encaminhar", base: ultimaThread })}><Forward className="h-4 w-4" /> Encaminhar</Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {compor && <Compor compor={compor} conta={account} onFechar={() => setCompor(null)} chamar={chamar} onEnviado={() => { setCompor(null); if (account) { carregarLista(account); if (threadSel) abrirThread(threadSel); } }} />}
    </TooltipProvider>
  );
}

// ── Uma mensagem da conversa ────────────────────────────────────────────────────────────────────
function Mensagem({ m, abertoInicial, onBaixar, onEstrela, onResponder, onResponderTodos, onEncaminhar }: {
  m: Msg; abertoInicial: boolean; onBaixar: (a: Msg["attachments"][number]) => void; onEstrela: () => void;
  onResponder: () => void; onResponderTodos: () => void; onEncaminhar: () => void;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [altura, setAltura] = useState(200);
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => { setAberto(abertoInicial); }, [abertoInicial]);
  const ajustar = () => { try { const h = ref.current?.contentWindow?.document?.documentElement?.scrollHeight; if (h) setAltura(Math.min(Math.max(h + 8, 80), 4000)); } catch { /* sandbox */ } };
  const quem = nomeDe(m);
  const anexos = (m.attachments || []).filter((a) => !a.inline);
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button className="w-full text-left px-4 py-3 flex items-start gap-3" onClick={() => setAberto((v) => !v)}>
        <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-xs font-semibold text-white" style={{ background: corDe(m.from_email || quem) }}>{iniciais(quem)}</AvatarFallback></Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{m.from_name || m.from_email}</span>
            {m.from_name && <span className="text-xs text-muted-foreground truncate hidden sm:inline">&lt;{m.from_email}&gt;</span>}
            <span className="ml-auto text-[11px] text-muted-foreground shrink-0" title={quandoLongo(m.internal_date)}>{quando(m.internal_date)}</span>
            <button onClick={(e) => { e.stopPropagation(); onEstrela(); }} className={cn(m.is_starred ? "text-amber-500" : "text-muted-foreground/50")}><Star className={cn("h-4 w-4", m.is_starred && "fill-current")} /></button>
          </div>
          {aberto ? (
            <p className="text-xs text-muted-foreground truncate">para {(m.to_list || []).map((a) => a.name || a.email).join(", ")}{m.cc_list?.length ? ` · cc ${m.cc_list.map((a) => a.name || a.email).join(", ")}` : ""}</p>
          ) : (
            <p className="text-xs text-muted-foreground truncate">{m.snippet}</p>
          )}
        </div>
      </button>
      {aberto && (
        <>
          <iframe ref={ref} title={m.subject || "e-mail"} sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" srcDoc={docDoEmail(m)} onLoad={ajustar} style={{ height: altura }} className="w-full border-0 bg-white" />
          {anexos.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {anexos.map((a, i) => (
                <button key={i} onClick={() => onBaixar(a)} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" /><span className="max-w-[200px] truncate">{a.filename}</span><span className="text-muted-foreground">{tamanho(a.size || 0)}</span><Download className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          <div className="px-4 pb-3 flex gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onResponder}><Reply className="h-3.5 w-3.5" /> Responder</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onResponderTodos}><ReplyAll className="h-3.5 w-3.5" /> Todos</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onEncaminhar}><Forward className="h-3.5 w-3.5" /> Encaminhar</Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Compor / responder / encaminhar ────────────────────────────────────────────────────────────
function Compor({ compor, conta, onFechar, chamar, onEnviado }: {
  compor: { modo: "novo" | "responder" | "todos" | "encaminhar"; base?: Msg }; conta: Account; onFechar: () => void;
  chamar: (b: Record<string, unknown>) => Promise<any>; onEnviado: () => void;
}) {
  const b = compor.base;
  const minha = conta.email.toLowerCase();
  const semEu = (l: Addr[]) => (l || []).map((a) => a.email).filter((e) => e && e.toLowerCase() !== minha);
  const inicialPara = compor.modo === "responder" || compor.modo === "todos" ? [b?.reply_to || b?.from_email || ""].filter(Boolean) : [];
  const inicialCc = compor.modo === "todos" ? [...semEu(b?.to_list || []), ...semEu(b?.cc_list || [])].filter((e) => e !== (b?.from_email || "")) : [];
  const assuntoBase = (b?.subject || "").replace(/^(re|fwd|enc|fw):\s*/i, "");
  const [para, setPara] = useState(inicialPara.join(", "));
  const [cc, setCc] = useState(inicialCc.join(", "));
  const [mostrarCc, setMostrarCc] = useState(inicialCc.length > 0);
  const [assunto, setAssunto] = useState(compor.modo === "novo" ? "" : compor.modo === "encaminhar" ? `Fwd: ${assuntoBase}` : `Re: ${assuntoBase}`);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<{ filename: string; mimeType: string; data: string; size: number }[]>([]);
  const [enviando, setEnviando] = useState(false);
  const citacao = b ? `<br><br><div style="color:#6b7280;font-size:12px">Em ${quandoLongo(b.internal_date)}, ${escapeHtml(b.from_name || "")} &lt;${escapeHtml(b.from_email || "")}&gt; escreveu:</div><blockquote style="border-left:3px solid #e5e7eb;margin:6px 0;padding-left:12px;color:#6b7280">${b.body_html || `<pre style="white-space:pre-wrap">${escapeHtml(b.body_text || b.snippet || "")}</pre>`}</blockquote>` : "";
  const lista = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /.+@.+\..+/.test(x));

  const anexar = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name} passa de 20 MB`); return; }
      const r = new FileReader();
      r.onload = () => setAnexos((p) => [...p, { filename: f.name, mimeType: f.type || "application/octet-stream", data: String(r.result).split(",")[1] || "", size: f.size }]);
      r.readAsDataURL(f);
    });
  };
  const enviar = async () => {
    const to = lista(para); if (!to.length) { toast.error("Informe pelo menos um destinatário válido"); return; }
    setEnviando(true);
    try {
      const html = `<div style="font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">${escapeHtml(texto).replace(/\n/g, "<br>")}</div>${compor.modo === "novo" ? "" : citacao}`;
      await chamar({ action: "send", to, cc: lista(cc), subject: assunto, html, text: texto, thread_id: compor.modo === "encaminhar" ? undefined : b?.thread_id, attachments: anexos.map(({ filename, mimeType, data }) => ({ filename, mimeType, data })) });
      toast.success("E-mail enviado"); onEnviado();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  const titulo = compor.modo === "novo" ? "Nova mensagem" : compor.modo === "encaminhar" ? "Encaminhar" : "Responder";
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2"><DialogTitle className="text-base" style={{ color: NAVY }}>{titulo}</DialogTitle></DialogHeader>
        <div className="px-4 space-y-2">
          <div className="flex items-center gap-2 border-b"><span className="text-xs text-muted-foreground w-10">Para</span><Input value={para} onChange={(e) => setPara(e.target.value)} placeholder="email@exemplo.com, outro@exemplo.com" className="border-0 shadow-none focus-visible:ring-0 px-0" />{!mostrarCc && <button className="text-xs text-muted-foreground" onClick={() => setMostrarCc(true)}>Cc</button>}</div>
          {mostrarCc && <div className="flex items-center gap-2 border-b"><span className="text-xs text-muted-foreground w-10">Cc</span><Input value={cc} onChange={(e) => setCc(e.target.value)} className="border-0 shadow-none focus-visible:ring-0 px-0" /></div>}
          <div className="flex items-center gap-2 border-b"><span className="text-xs text-muted-foreground w-10">Assunto</span><Input value={assunto} onChange={(e) => setAssunto(e.target.value)} className="border-0 shadow-none focus-visible:ring-0 px-0" /></div>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva aqui..." className="min-h-[220px] border-0 shadow-none focus-visible:ring-0 px-0 resize-y" autoFocus />
          {b && compor.modo !== "novo" && <p className="text-[11px] text-muted-foreground">A mensagem original vai citada abaixo do seu texto.</p>}
          {anexos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {anexos.map((a, i) => <span key={i} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"><Paperclip className="h-3 w-3" />{a.filename} <span className="text-muted-foreground">{tamanho(a.size)}</span><button onClick={() => setAnexos((p) => p.filter((_, k) => k !== i))}><X className="h-3 w-3" /></button></span>)}
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t flex items-center gap-2">
          <Button onClick={enviar} disabled={enviando} className="gap-2" style={{ background: NAVY }}>{enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar</Button>
          <label className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Paperclip className="h-4 w-4" /> Anexar<input type="file" multiple className="hidden" onChange={(e) => { anexar(e.target.files); e.currentTarget.value = ""; }} /></label>
          <span className="ml-auto text-[11px] text-muted-foreground">de {conta.email}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
