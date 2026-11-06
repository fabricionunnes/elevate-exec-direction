// E-mail dentro do Nexus (Fabrício, 05/11/2026: "uma plataforma mais bonita pra ter isso").
// Caixa do Gmail do próprio usuário, sincronizada pelo gmail-sync (cron a cada minuto + realtime).
// Três colunas: pastas, lista por conversa, leitura. Compor, responder, encaminhar, anexos, busca
// e vínculo com o lead do CRM pelo e-mail do remetente.
// 06/11: redesenho premium. Seleção com ações em massa (lida, não lida, importante, estrela,
// arquivar, spam, lixeira, restaurar), marcador de importante, pastas Importantes e Todos,
// filtros rápidos, ações ao passar o mouse e atalhos de teclado (j/k, e, #, s, i, u, x, c, /).
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Search, RefreshCw, Loader2, PenSquare, X, ChevronLeft, ChevronRight, Tag, Download, UserRound, ExternalLink, Plug,
  Bookmark, Layers, Undo2, Languages, CheckCheck, Keyboard, FileText, Image as ImageIcon, FileSpreadsheet, FileArchive,
} from "lucide-react";

type Addr = { name: string; email: string };
type Msg = {
  id: string; account_id: string; gmail_id: string; thread_id: string; label_ids: string[];
  from_name: string | null; from_email: string | null; to_list: Addr[]; cc_list: Addr[]; bcc_list: Addr[];
  subject: string | null; snippet: string | null; internal_date: string; is_unread: boolean; is_starred: boolean;
  is_sent: boolean; has_attachments: boolean; attachments: { attachmentId: string | null; filename: string; mimeType: string; size: number; contentId: string | null; inline?: boolean }[];
  body_html: string | null; body_text: string | null; body_loaded: boolean; message_id_header: string | null; references_header: string | null;
  reply_to?: string | null;
  lang?: string | null; subject_pt?: string | null; snippet_pt?: string | null; body_pt?: string | null; translated_at?: string | null;
};
type Label = { gmail_label_id: string; name: string; type: string | null; color: string | null };
type Account = { id: string; email: string; backfill_done: boolean; last_sync_at: string | null; last_error: string | null };
type Conversa = { ultima: Msg; qtd: number; naoLida: boolean; estrela: boolean; importante: boolean; anexo: boolean; ids: string[] };
type Filtro = "todas" | "nao-lidas" | "importantes" | "estrela" | "anexo";

const NAVY = "#0D2B5E";
// Fabrício (06/11): padrão de 20 por página, podendo escolher 50 ou 100 (fica lembrado no navegador)
const TAMANHOS_PAGINA = [20, 50, 100] as const;
const tamanhoSalvo = () => { try { const n = Number(localStorage.getItem("nexus-email-por-pagina")); return (TAMANHOS_PAGINA as readonly number[]).includes(n) ? n : 20; } catch { return 20; } };
const PASTAS: { key: string; nome: string; icon: typeof Inbox }[] = [
  { key: "INBOX", nome: "Entrada", icon: Inbox },
  { key: "IMPORTANT", nome: "Importantes", icon: Bookmark },
  { key: "STARRED", nome: "Com estrela", icon: Star },
  { key: "SENT", nome: "Enviados", icon: Send },
  { key: "DRAFT", nome: "Rascunhos", icon: PenSquare },
  { key: "ALL", nome: "Todos os e-mails", icon: Layers },
  { key: "SPAM", nome: "Spam", icon: AlertOctagon },
  { key: "TRASH", nome: "Lixeira", icon: Trash2 },
];
const SISTEMA = new Set(["INBOX", "STARRED", "SENT", "DRAFT", "SPAM", "TRASH", "UNREAD", "IMPORTANT", "CHAT", "CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "CATEGORY_FORUMS"]);
const FILTROS: { key: Filtro; nome: string }[] = [
  { key: "todas", nome: "Todas" }, { key: "nao-lidas", nome: "Não lidas" }, { key: "importantes", nome: "Importantes" }, { key: "estrela", nome: "Com estrela" }, { key: "anexo", nome: "Com anexo" },
];

const iniciais = (s: string) => (s || "?").replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
const corDe = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 42% 44%)`; };
const quando = (iso: string) => { const d = new Date(iso); return isToday(d) ? format(d, "HH:mm") : isThisYear(d) ? format(d, "d 'de' MMM", { locale: ptBR }) : format(d, "dd/MM/yy"); };
const quandoLongo = (iso: string) => format(new Date(iso), "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
const nomeDe = (m: Msg) => m.from_name || m.from_email || "?";
const tamanho = (n: number) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const temLabel = (m: Msg, l: string) => (m.label_ids || []).includes(l);
// em português quando o e-mail veio em outro idioma e já tem tradução
const traduzido = (m: Msg) => !!m.lang && m.lang !== "pt";
const assuntoPt = (m: Msg) => (traduzido(m) && m.subject_pt) || m.subject;
const trechoPt = (m: Msg) => (traduzido(m) && m.snippet_pt) || m.snippet;
const NOME_IDIOMA: Record<string, string> = { en: "inglês", es: "espanhol", fr: "francês", de: "alemão", it: "italiano", nl: "holandês", ja: "japonês", zh: "chinês", ko: "coreano", ru: "russo" };
const iconeDoAnexo = (mime: string) => (/image\//.test(mime) ? ImageIcon : /spreadsheet|excel|csv/.test(mime) ? FileSpreadsheet : /zip|rar|7z|compressed/.test(mime) ? FileArchive : FileText);

// HTML do e-mail numa sandbox: sem script, links abrem fora, largura contida
function docDoEmail(m: Msg): string {
  const corpo = m.body_html || (m.body_text ? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(m.body_text)}</pre>` : `<p style="color:#6b7280">${escapeHtml(m.snippet || "")}</p>`);
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>body{margin:0;padding:18px 22px;font:14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;word-break:break-word}img{max-width:100%;height:auto}blockquote{border-left:3px solid #e5e7eb;margin:8px 0;padding-left:12px;color:#6b7280}a{color:#0D2B5E}table{max-width:100%}</style>
</head><body>${corpo}</body></html>`;
}

export default function CRMEmailPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [precisaConectar, setPrecisaConectar] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [pasta, setPasta] = useState<string>(params.get("pasta") || "INBOX");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [pagina, setPagina] = useState(1);
  const [POR_PAGINA, setPorPagina] = useState<number>(tamanhoSalvo);
  const mudarTamanho = (n: number) => { setPorPagina(n); setPagina(1); setSelecionadas(new Set()); setCursor(-1); try { localStorage.setItem("nexus-email-por-pagina", String(n)); } catch { /* sem armazenamento */ } };
  const [busca, setBusca] = useState("");
  const [buscaIds, setBuscaIds] = useState<string[] | null>(null);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [naoLidas, setNaoLidas] = useState<Record<string, number>>({});
  const [threadSel, setThreadSel] = useState<string | null>(params.get("thread"));
  const [thread, setThread] = useState<Msg[]>([]);
  const [carregandoThread, setCarregandoThread] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<number>(-1);
  const [mostrarAtalhos, setMostrarAtalhos] = useState(false);
  const [compor, setCompor] = useState<null | { modo: "novo" | "responder" | "todos" | "encaminhar"; base?: Msg }>(null);
  const [leadDoRemetente, setLeadDoRemetente] = useState<{ id: string; name: string; company: string | null; stage: string | null } | null>(null);
  const [mobileLendo, setMobileLendo] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  // pasta/busca atuais num ref: o realtime e cargas antigas nunca sobrescrevem a lista da pasta nova
  const estadoLista = useRef({ pasta, buscaIds });
  estadoLista.current = { pasta, buscaIds };
  const seqLista = useRef(0);

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
    const chaves = ["INBOX", "IMPORTANT", "SPAM", "DRAFT", ...((data as Label[]) || []).filter((l) => l.type === "user").map((l) => l.gmail_label_id)];
    const contagem: Record<string, number> = {};
    await Promise.all(chaves.map(async (k) => {
      const { count } = await db.from("mail_messages").select("id", { count: "exact", head: true }).eq("account_id", acc.id).eq("is_unread", true).contains("label_ids", [k]).not("label_ids", "cs", "{TRASH}");
      contagem[k] = count || 0;
    }));
    setNaoLidas(contagem);
  }, []);

  const carregarLista = useCallback(async (acc: Account, silencioso = false) => {
    const { pasta, buscaIds } = estadoLista.current;
    const seq = ++seqLista.current;
    if (!silencioso) setCarregando(true); // atualização de fundo (realtime) não pisca a lista
    let q = db.from("mail_messages")
      .select("id, account_id, gmail_id, thread_id, label_ids, from_name, from_email, to_list, subject, snippet, internal_date, is_unread, is_starred, is_sent, has_attachments, lang, subject_pt, snippet_pt")
      .eq("account_id", acc.id).order("internal_date", { ascending: false }).limit(1000);
    if (buscaIds) q = buscaIds.length ? q.in("gmail_id", buscaIds) : q.in("gmail_id", ["-"]);
    else if (pasta === "TRASH" || pasta === "SPAM") q = q.contains("label_ids", [pasta]);
    else if (pasta === "ALL") q = q.not("label_ids", "cs", "{TRASH}").not("label_ids", "cs", "{SPAM}");
    else q = q.contains("label_ids", [pasta]).not("label_ids", "cs", "{TRASH}").not("label_ids", "cs", "{SPAM}");
    const { data } = await q;
    if (seq !== seqLista.current) return; // chegou uma carga mais nova (outra pasta) no meio
    setMensagens((data as Msg[]) || []);
    setCarregando(false);
  }, []);
  // troca de pasta/busca recarrega
  useEffect(() => { if (account) carregarLista(account); }, [pasta, buscaIds, account, carregarLista]);

  useEffect(() => { if (account) { carregarLabels(account); carregarLista(account); } }, [account, carregarLabels, carregarLista]);
  useEffect(() => { setSelecionadas(new Set()); setCursor(-1); setPagina(1); }, [pasta, buscaIds, filtro]);

  // Realtime: mudanças na própria caixa recarregam a lista e os contadores, amortecidas (a sincronização
  // e a importação inserem em rajada; sem isso a tela piscava a cada mensagem)
  useEffect(() => {
    if (!account) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const agendar = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; carregarLista(account, true); carregarLabels(account); }, 1500); };
    const ch = supabase.channel(`mail-${account.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mail_messages", filter: `account_id=eq.${account.id}` }, agendar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mail_accounts", filter: `id=eq.${account.id}` }, (p) => setAccount(p.new as Account))
      .subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(ch); };
  }, [account, carregarLista, carregarLabels]);

  // Conversas: a mensagem mais recente de cada thread + quantidade
  const todasConversas = useMemo<Conversa[]>(() => {
    const porThread = new Map<string, Conversa>();
    for (const m of mensagens) {
      const t = porThread.get(m.thread_id);
      if (!t) porThread.set(m.thread_id, { ultima: m, qtd: 1, naoLida: m.is_unread, estrela: m.is_starred, importante: temLabel(m, "IMPORTANT"), anexo: m.has_attachments, ids: [m.gmail_id] });
      else { t.qtd++; t.naoLida = t.naoLida || m.is_unread; t.estrela = t.estrela || m.is_starred; t.importante = t.importante || temLabel(m, "IMPORTANT"); t.anexo = t.anexo || m.has_attachments; t.ids.push(m.gmail_id); if (m.internal_date > t.ultima.internal_date) t.ultima = m; }
    }
    const lista = [...porThread.values()].sort((a, b) => b.ultima.internal_date.localeCompare(a.ultima.internal_date));
    if (filtro === "nao-lidas") return lista.filter((c) => c.naoLida);
    if (filtro === "importantes") return lista.filter((c) => c.importante);
    if (filtro === "estrela") return lista.filter((c) => c.estrela);
    if (filtro === "anexo") return lista.filter((c) => c.anexo);
    return lista;
  }, [mensagens, filtro]);
  const totalPaginas = Math.max(1, Math.ceil(todasConversas.length / POR_PAGINA));
  useEffect(() => { if (pagina > totalPaginas) setPagina(totalPaginas); }, [pagina, totalPaginas]);
  // só a página atual (20 por página)
  const conversas = useMemo(() => todasConversas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), [todasConversas, pagina, POR_PAGINA]);
  // traduz assunto/trecho da página visível que ainda não tem idioma detectado (lote de 20, uma chamada)
  const pedidosTraducao = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = conversas.map((c) => c.ultima).filter((m) => !m.lang && !pedidosTraducao.current.has(m.gmail_id)).map((m) => m.gmail_id);
    if (!ids.length) return;
    ids.forEach((id) => pedidosTraducao.current.add(id));
    for (let i = 0; i < ids.length; i += 20) {
      chamar({ action: "translate-list", gmail_ids: ids.slice(i, i + 20) }).then((r) => {
        const porId = new Map<string, Partial<Msg>>((r?.items || []).map((x: Partial<Msg> & { gmail_id: string }) => [x.gmail_id, x]));
        setMensagens((prev) => prev.map((m) => (porId.has(m.gmail_id) ? { ...m, ...porId.get(m.gmail_id) } : m)));
      }).catch(() => {});
    }
  }, [conversas, chamar]);
  const mudarPagina = (p: number) => { setPagina(Math.min(totalPaginas, Math.max(1, p))); setSelecionadas(new Set()); setCursor(-1); };

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
    const naoLidasIds = msgs.filter((m) => m.is_unread).map((m) => m.gmail_id);
    if (naoLidasIds.length) {
      setMensagens((prev) => prev.map((m) => (naoLidasIds.includes(m.gmail_id) ? { ...m, is_unread: false } : m)));
      chamar({ action: "modify", gmail_ids: naoLidasIds, remove: ["UNREAD"] }).catch(() => {});
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

  const fecharThread = useCallback(() => { setThreadSel(null); setThread([]); setMobileLendo(false); setLeadDoRemetente(null); setParams((p) => { p.delete("thread"); return p; }, { replace: true }); }, [setParams]);

  // ── Ações (uma conversa ou várias) ──────────────────────────────────────────────────────────
  const modificar = useCallback(async (ids: string[], add: string[], remove: string[], otimista?: (m: Msg) => Msg) => {
    if (!ids.length) return;
    if (otimista) { setMensagens((prev) => prev.map((m) => (ids.includes(m.gmail_id) ? otimista(m) : m))); setThread((prev) => prev.map((m) => (ids.includes(m.gmail_id) ? otimista(m) : m))); }
    try { await chamar({ action: "modify", gmail_ids: ids, add, remove }); } catch (e) { toast.error((e as Error).message); }
  }, [chamar]);
  const idsDe = useCallback((threads: string[]) => mensagens.filter((m) => threads.includes(m.thread_id)).map((m) => m.gmail_id), [mensagens]);
  const tirarDaLista = useCallback((threads: string[]) => {
    setMensagens((p) => p.filter((m) => !threads.includes(m.thread_id)));
    setSelecionadas((s) => { const n = new Set(s); threads.forEach((t) => n.delete(t)); return n; });
    if (threadSel && threads.includes(threadSel)) fecharThread();
  }, [threadSel, fecharThread]);
  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios.replace("{n}", String(n)));

  const arquivar = useCallback((threads: string[]) => { modificar(idsDe(threads), [], ["INBOX"]); tirarDaLista(threads); toast.success(plural(threads.length, "Conversa arquivada", "{n} conversas arquivadas")); }, [modificar, idsDe, tirarDaLista]);
  const lixeira = useCallback((threads: string[]) => { modificar(idsDe(threads), ["TRASH"], ["INBOX", "SPAM"]); tirarDaLista(threads); toast.success(plural(threads.length, "Movida pra lixeira", "{n} conversas movidas pra lixeira")); }, [modificar, idsDe, tirarDaLista]);
  const spam = useCallback((threads: string[]) => { modificar(idsDe(threads), ["SPAM"], ["INBOX"]); tirarDaLista(threads); toast.success(plural(threads.length, "Marcada como spam", "{n} conversas marcadas como spam")); }, [modificar, idsDe, tirarDaLista]);
  const restaurar = useCallback((threads: string[]) => { modificar(idsDe(threads), ["INBOX"], ["TRASH", "SPAM"]); tirarDaLista(threads); toast.success(plural(threads.length, "Conversa movida pra Entrada", "{n} conversas movidas pra Entrada")); }, [modificar, idsDe, tirarDaLista]);
  const excluirDeVez = useCallback(async (threads: string[]) => {
    const ids = idsDe(threads);
    if (!ids.length) return;
    if (!window.confirm(threads.length === 1 ? "Excluir esta conversa definitivamente? Não dá pra desfazer." : `Excluir ${threads.length} conversas definitivamente? Não dá pra desfazer.`)) return;
    try {
      await chamar({ action: "delete", gmail_ids: ids });
      tirarDaLista(threads);
      toast.success(plural(threads.length, "Conversa excluída definitivamente", "{n} conversas excluídas definitivamente"));
    } catch (e) { toast.error((e as Error).message); }
  }, [chamar, idsDe, tirarDaLista]);
  const marcarLidas = useCallback((threads: string[], lida: boolean) => {
    const ids = idsDe(threads);
    modificar(ids, lida ? [] : ["UNREAD"], lida ? ["UNREAD"] : [], (x) => ({ ...x, is_unread: !lida }));
    if (!lida && threadSel && threads.includes(threadSel)) fecharThread();
    toast.success(lida ? plural(threads.length, "Marcada como lida", "{n} marcadas como lidas") : plural(threads.length, "Marcada como não lida", "{n} marcadas como não lidas"));
  }, [modificar, idsDe, threadSel, fecharThread]);
  const marcarImportante = useCallback((threads: string[], importante: boolean) => {
    const ids = idsDe(threads);
    modificar(ids, importante ? ["IMPORTANT"] : [], importante ? [] : ["IMPORTANT"], (x) => ({ ...x, label_ids: importante ? [...new Set([...(x.label_ids || []), "IMPORTANT"])] : (x.label_ids || []).filter((l) => l !== "IMPORTANT") }));
    if (!importante && pasta === "IMPORTANT") tirarDaLista(threads);
    toast.success(importante ? plural(threads.length, "Marcada como importante", "{n} marcadas como importantes") : plural(threads.length, "Importante removido", "Importante removido de {n} conversas"));
  }, [modificar, idsDe, pasta, tirarDaLista]);
  const marcarEstrela = useCallback((threads: string[], com: boolean) => {
    // estrela só na última mensagem de cada conversa (igual ao Gmail)
    const ids = conversas.filter((c) => threads.includes(c.ultima.thread_id)).map((c) => c.ultima.gmail_id);
    modificar(ids, com ? ["STARRED"] : [], com ? [] : ["STARRED"], (x) => ({ ...x, is_starred: com }));
    if (!com && pasta === "STARRED") tirarDaLista(threads);
  }, [modificar, conversas, pasta, tirarDaLista]);
  const estrelaMsg = (m: Msg) => modificar([m.gmail_id], m.is_starred ? [] : ["STARRED"], m.is_starred ? ["STARRED"] : [], (x) => ({ ...x, is_starred: !m.is_starred }));

  const alternarSelecao = (threadId: string) => setSelecionadas((s) => { const n = new Set(s); if (n.has(threadId)) n.delete(threadId); else n.add(threadId); return n; });
  const todasSelecionadas = conversas.length > 0 && conversas.every((c) => selecionadas.has(c.ultima.thread_id));
  const selecionarTodas = () => setSelecionadas(todasSelecionadas ? new Set() : new Set(conversas.map((c) => c.ultima.thread_id)));
  const sel = [...selecionadas];
  const selConversas = conversas.filter((c) => selecionadas.has(c.ultima.thread_id));
  const selTodasLidas = selConversas.length > 0 && selConversas.every((c) => !c.naoLida);
  const selTodasImportantes = selConversas.length > 0 && selConversas.every((c) => c.importante);
  const selTodasEstrela = selConversas.length > 0 && selConversas.every((c) => c.estrela);
  const naLixeiraOuSpam = pasta === "TRASH" || pasta === "SPAM";

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
    try { await startGoogleCalendarConnection("/email"); } catch (e) { toast.error((e as Error).message); }
  };

  const irParaPasta = (key: string) => { setBusca(""); setBuscaIds(null); setFiltro("todas"); setPasta(key); setParams((q) => { q.set("pasta", key); return q; }, { replace: true }); fecharThread(); };

  // ── Atalhos de teclado (fora de campos de texto e sem o compositor aberto) ──────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = !!alvo && (["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || alvo.isContentEditable);
      if (compor || mostrarAtalhos) { if (e.key === "Escape") setMostrarAtalhos(false); return; }
      if (digitando) { if (e.key === "Escape") (alvo as HTMLElement).blur(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const atual = threadSel ? conversas.findIndex((c) => c.ultima.thread_id === threadSel) : cursor;
      const alvoThreads = selecionadas.size ? [...selecionadas] : threadSel ? [threadSel] : atual >= 0 && conversas[atual] ? [conversas[atual].ultima.thread_id] : [];
      switch (e.key) {
        case "j": case "ArrowDown": { e.preventDefault(); const i = Math.min(conversas.length - 1, atual + 1); if (i >= 0) { setCursor(i); if (threadSel) abrirThread(conversas[i].ultima.thread_id); } break; }
        case "k": case "ArrowUp": { e.preventDefault(); const i = Math.max(0, atual - 1); if (conversas[i]) { setCursor(i); if (threadSel) abrirThread(conversas[i].ultima.thread_id); } break; }
        case "Enter": case "o": { if (cursor >= 0 && conversas[cursor]) abrirThread(conversas[cursor].ultima.thread_id); break; }
        case "x": { if (atual >= 0 && conversas[atual]) alternarSelecao(conversas[atual].ultima.thread_id); break; }
        case "e": { if (alvoThreads.length && !naLixeiraOuSpam) arquivar(alvoThreads); break; }
        case "#": case "Delete": case "Backspace": { if (alvoThreads.length) { e.preventDefault(); if (naLixeiraOuSpam) excluirDeVez(alvoThreads); else lixeira(alvoThreads); } break; }
        case "s": { if (alvoThreads.length) { const c = conversas.find((k) => k.ultima.thread_id === alvoThreads[0]); marcarEstrela(alvoThreads, !(c?.estrela)); } break; }
        case "i": { if (alvoThreads.length) { const c = conversas.find((k) => k.ultima.thread_id === alvoThreads[0]); marcarImportante(alvoThreads, !(c?.importante)); } break; }
        case "u": { if (alvoThreads.length) marcarLidas(alvoThreads, false); break; }
        case "!": { if (alvoThreads.length && !naLixeiraOuSpam) spam(alvoThreads); break; }
        case "r": { if (threadSel && thread.length) { e.preventDefault(); setCompor({ modo: "responder", base: thread[thread.length - 1] }); } break; }
        case "c": { e.preventDefault(); setCompor({ modo: "novo" }); break; }
        case "/": { e.preventDefault(); buscaRef.current?.focus(); break; }
        case "?": { setMostrarAtalhos(true); break; }
        case "]": { mudarPagina(pagina + 1); break; }
        case "[": { mudarPagina(pagina - 1); break; }
        case "Escape": { if (selecionadas.size) setSelecionadas(new Set()); else if (threadSel) fecharThread(); break; }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compor, mostrarAtalhos, threadSel, cursor, conversas, selecionadas, naLixeiraOuSpam, abrirThread, arquivar, lixeira, excluirDeVez, marcarEstrela, marcarImportante, marcarLidas, spam, fecharThread, thread, pagina, totalPaginas]);

  // ── Estados vazios ──
  if (account === undefined) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!account || precisaConectar) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-2xl border bg-card p-10 text-center space-y-4 shadow-sm">
        <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: "#0D2B5E10" }}><Mail className="h-8 w-8" style={{ color: NAVY }} /></div>
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: NAVY }}>Seu e-mail dentro do Nexus</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">Conecte sua conta Google uma vez. O Nexus passa a mostrar sua caixa de entrada aqui, com atualização automática, e você responde sem sair do sistema.</p>
        <Button onClick={conectar} className="gap-2 h-10 px-5" style={{ background: NAVY }}><Plug className="h-4 w-4" /> Conectar meu Gmail</Button>
        <p className="text-[11px] text-muted-foreground">Se você já tinha o Google conectado pra agenda, vai só confirmar a permissão do Gmail.</p>
      </div>
    );
  }

  const ultimaThread = thread[thread.length - 1];
  const assuntoThread = (thread[0] && assuntoPt(thread[0])) || (() => { const u = conversas.find((c) => c.ultima.thread_id === threadSel)?.ultima; return u ? assuntoPt(u) : ""; })() || "";
  const conversaAberta = conversas.find((c) => c.ultima.thread_id === threadSel);
  const threadImportante = thread.some((m) => temLabel(m, "IMPORTANT")) || !!conversaAberta?.importante;
  const threadEstrela = thread.some((m) => m.is_starred) || !!conversaAberta?.estrela;
  // a migração do cPanel criou marcadores "INBOX.Sent", "INBOX.Trash" etc. (pastas do IMAP): esconde os que
  // duplicam pastas do Gmail e mostra os demais sem o prefixo
  const DUPLICADOS = /^INBOX\.(Archive|Drafts|Junk|Sent|spam|Spam|Trash)$/i;
  const labelsUsuario = labels.filter((l) => l.type === "user" && !SISTEMA.has(l.gmail_label_id) && !DUPLICADOS.test(l.name)).map((l) => ({ ...l, name: l.name.replace(/^INBOX\./i, "") }));
  const tituloPasta = PASTAS.find((p) => p.key === pasta)?.nome || labelsUsuario.find((l) => l.gmail_label_id === pasta)?.name || "E-mails";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-7.5rem)] min-h-[520px] rounded-2xl border bg-card overflow-hidden shadow-sm">
        {/* Pastas */}
        <aside className={cn("w-60 shrink-0 border-r flex flex-col bg-muted/20", mobileLendo ? "hidden lg:flex" : "hidden md:flex")}>
          <div className="p-3 pb-2">
            <Button className="w-full gap-2 h-10 rounded-xl shadow-sm font-medium" style={{ background: NAVY }} onClick={() => setCompor({ modo: "novo" })}><PenSquare className="h-4 w-4" /> Escrever</Button>
          </div>
          <ScrollArea className="flex-1">
            <nav className="px-2 pb-2 space-y-0.5">
              {PASTAS.map((p) => {
                const Icon = p.icon; const ativo = pasta === p.key && !buscaIds; const n = naoLidas[p.key] || 0;
                return (
                  <button key={p.key} onClick={() => irParaPasta(p.key)}
                    className={cn("w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors", ativo ? "font-semibold text-white shadow-md" : "hover:bg-muted/70 text-foreground/75")}
                    style={ativo ? { background: NAVY } : undefined} aria-current={ativo ? "page" : undefined}>
                    <Icon className={cn("h-4 w-4 shrink-0", !ativo && (p.key === "IMPORTANT" || p.key === "STARRED") && "text-amber-500", ativo && (p.key === "IMPORTANT" || p.key === "STARRED") && "text-amber-300")} /><span className="flex-1 text-left truncate">{p.nome}</span>
                    {n > 0 && <span className={cn("text-[11px] font-semibold tabular-nums rounded-full px-1.5 py-0.5 min-w-[20px] text-center", ativo ? "bg-white" : "text-white")} style={ativo ? { color: NAVY } : { background: NAVY }}>{n}</span>}
                  </button>
                );
              })}
              {labelsUsuario.length > 0 && <p className="px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Marcadores</p>}
              {labelsUsuario.map((l) => {
                const ativo = pasta === l.gmail_label_id && !buscaIds; const n = naoLidas[l.gmail_label_id] || 0;
                return (
                  <button key={l.gmail_label_id} onClick={() => irParaPasta(l.gmail_label_id)}
                    className={cn("w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors", ativo ? "font-semibold text-white shadow-md" : "hover:bg-muted/70 text-foreground/75")}
                    style={ativo ? { background: NAVY } : undefined} aria-current={ativo ? "page" : undefined}>
                    <Tag className="h-3.5 w-3.5 shrink-0" style={{ color: ativo ? "#fff" : l.color || undefined }} /><span className="flex-1 text-left truncate">{l.name}</span>
                    {n > 0 && <span className={cn("text-[11px] tabular-nums", ativo ? "text-white/80" : "text-muted-foreground")}>{n}</span>}
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
          <div className="border-t p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="truncate font-medium text-foreground/80">{account.email}</p>
            <p className="flex items-center gap-1.5"><span className={cn("h-1.5 w-1.5 rounded-full", account.last_error ? "bg-destructive" : "bg-emerald-500")} />{account.backfill_done ? "Caixa sincronizada" : "Carregando histórico (90 dias)..."}</p>
            {account.last_error && <p className="text-destructive truncate" title={account.last_error}>Erro: {account.last_error}</p>}
            <button onClick={() => setMostrarAtalhos(true)} className="flex items-center gap-1 hover:text-foreground"><Keyboard className="h-3 w-3" /> Atalhos</button>
          </div>
        </aside>

        {/* Lista */}
        <section className={cn("w-full md:w-[400px] lg:w-[440px] shrink-0 border-r flex flex-col min-w-0", mobileLendo && "hidden lg:flex")}>
          <div className="p-2.5 border-b space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") buscar(busca); if (e.key === "Escape") { setBusca(""); setBuscaIds(null); } }}
                  placeholder="Buscar no Gmail (de:, assunto:, has:attachment...)" className="pl-8 h-9 rounded-lg bg-muted/40 border-transparent focus-visible:bg-background" />
                {buscaIds && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => { setBusca(""); setBuscaIds(null); }}><X className="h-4 w-4" /></button>}
              </div>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={sincronizar} disabled={sincronizando}><RefreshCw className={cn("h-4 w-4", sincronizando && "animate-spin")} /></Button>
              </TooltipTrigger><TooltipContent>Sincronizar agora</TooltipContent></Tooltip>
              <Button size="icon" className="h-9 w-9 md:hidden" style={{ background: NAVY }} onClick={() => setCompor({ modo: "novo" })}><PenSquare className="h-4 w-4" /></Button>
            </div>
            {selecionadas.size > 0 ? (
              <div className="flex items-center gap-0.5 rounded-lg px-1.5 py-1" style={{ background: "#0D2B5E0f" }}>
                <Checkbox checked={todasSelecionadas} onCheckedChange={selecionarTodas} className="ml-1 mr-1.5" aria-label="Selecionar todas" />
                <span className="text-xs font-semibold tabular-nums mr-1" style={{ color: NAVY }}>{selecionadas.size}</span>
                <Acao icone={selTodasLidas ? Mail : MailOpen} rotulo={selTodasLidas ? "Marcar como não lidas" : "Marcar como lidas"} onClick={() => marcarLidas(sel, !selTodasLidas)} />
                <Acao icone={Bookmark} rotulo={selTodasImportantes ? "Tirar importante" : "Marcar como importantes"} ativo={selTodasImportantes} onClick={() => marcarImportante(sel, !selTodasImportantes)} />
                <Acao icone={Star} rotulo={selTodasEstrela ? "Tirar estrela" : "Marcar com estrela"} ativo={selTodasEstrela} onClick={() => marcarEstrela(sel, !selTodasEstrela)} />
                {naLixeiraOuSpam ? (
                  <Acao icone={Undo2} rotulo={pasta === "SPAM" ? "Não é spam" : "Restaurar pra Entrada"} onClick={() => restaurar(sel)} />
                ) : (
                  <>
                    <Acao icone={Archive} rotulo="Arquivar" onClick={() => arquivar(sel)} />
                    <Acao icone={AlertOctagon} rotulo="Marcar como spam" onClick={() => spam(sel)} />
                  </>
                )}
                {pasta !== "TRASH" && <Acao icone={Trash2} rotulo="Excluir (lixeira)" perigo onClick={() => lixeira(sel)} />}
                {naLixeiraOuSpam && <Acao icone={Trash2} rotulo="Excluir definitivamente" perigo onClick={() => excluirDeVez(sel)} />}
                <button onClick={() => setSelecionadas(new Set())} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground px-1.5">Limpar</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Checkbox checked={todasSelecionadas} onCheckedChange={selecionarTodas} className="ml-2 mr-1" aria-label="Selecionar todas" disabled={conversas.length === 0} />
                <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                  {FILTROS.map((f) => (
                    <button key={f.key} onClick={() => setFiltro(f.key)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors border", filtro === f.key ? "text-white border-transparent" : "text-muted-foreground border-border/70 hover:bg-muted/60")} style={filtro === f.key ? { background: NAVY } : undefined}>{f.nome}</button>
                  ))}
                </div>
                {conversas.some((c) => c.naoLida) && (
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => marcarLidas(conversas.filter((c) => c.naoLida).map((c) => c.ultima.thread_id), true)}><CheckCheck className="h-4 w-4" /></Button>
                  </TooltipTrigger><TooltipContent>Marcar tudo como lido</TooltipContent></Tooltip>
                )}
              </div>
            )}
          </div>
          <div className="px-3 py-1.5 border-b flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium">{buscaIds ? "Resultado da busca" : tituloPasta}</span>
            <span className="tabular-nums">{todasConversas.length === 0 ? "0 conversas" : `${(pagina - 1) * POR_PAGINA + 1}–${Math.min(pagina * POR_PAGINA, todasConversas.length)} de ${todasConversas.length}`}</span>
          </div>
          <ScrollArea className="flex-1">
            {carregando && conversas.length === 0 ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : conversas.length === 0 ? (
              <div className="py-20 text-center text-sm text-muted-foreground space-y-2">
                <MailOpen className="h-8 w-8 mx-auto opacity-30" />
                <p>{buscaIds ? "Nada encontrado." : !account.backfill_done ? "Carregando sua caixa... os e-mails aparecem aqui em instantes." : filtro !== "todas" ? "Nada com esse filtro." : "Nenhum e-mail aqui."}</p>
              </div>
            ) : (
              <ul>
                {conversas.map((c, i) => {
                  const m = c.ultima;
                  const aberta = threadSel === m.thread_id;
                  const marcada = selecionadas.has(m.thread_id);
                  const foco = cursor === i && !threadSel;
                  const quem = m.is_sent ? `Para: ${(m.to_list || []).map((a) => a.name || a.email).join(", ") || "?"}` : nomeDe(m);
                  const nomeAvatar = m.is_sent ? (m.to_list?.[0]?.name || m.to_list?.[0]?.email || "?") : quem;
                  return (
                    <li key={m.thread_id} className={cn("relative group border-b border-border/50 transition-colors", aberta ? "bg-[#0D2B5E]/[0.09] shadow-[inset_0_0_0_1px_rgba(13,43,94,0.18)]" : marcada ? "bg-[#0D2B5E]/[0.06]" : c.naoLida ? "bg-card hover:bg-muted/40" : "bg-muted/[0.15] hover:bg-muted/40", foco && "ring-1 ring-inset ring-[#0D2B5E]/40")} aria-selected={aberta}>
                      {(aberta || c.naoLida) && <span className={cn("absolute left-0 top-0 bottom-0", aberta ? "w-1" : "w-[3px]")} style={{ background: aberta ? NAVY : "#0D2B5E55" }} />}
                      <div className="flex gap-2.5 px-3 py-2.5">
                        <div className="relative h-9 w-9 shrink-0 mt-0.5">
                          <Avatar className={cn("h-9 w-9 transition-opacity", (marcada || selecionadas.size > 0) ? "opacity-0" : "group-hover:opacity-0")}><AvatarFallback className="text-xs font-semibold text-white" style={{ background: corDe(m.from_email || quem) }}>{iniciais(nomeAvatar)}</AvatarFallback></Avatar>
                          <div className={cn("absolute inset-0 flex items-center justify-center transition-opacity", (marcada || selecionadas.size > 0) ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                            <Checkbox checked={marcada} onCheckedChange={() => alternarSelecao(m.thread_id)} aria-label="Selecionar conversa" className="h-[18px] w-[18px]" />
                          </div>
                        </div>
                        <button onClick={(e) => { if (selecionadas.size > 0 && !e.metaKey) { alternarSelecao(m.thread_id); return; } setCursor(i); abrirThread(m.thread_id); }} className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className={cn("truncate text-[13px] flex-1", c.naoLida || aberta ? "font-semibold text-foreground" : "font-medium text-foreground/75")}>{quem}</span>
                            {c.qtd > 1 && <span className="text-[10px] text-muted-foreground tabular-nums rounded bg-muted px-1">{c.qtd}</span>}
                            <span className={cn("text-[11px] tabular-nums shrink-0 group-hover:hidden", c.naoLida ? "font-semibold" : "text-muted-foreground")} style={c.naoLida ? { color: NAVY } : undefined}>{quando(m.internal_date)}</span>
                          </div>
                          <p className={cn("truncate text-[13px] flex items-center gap-1.5", aberta ? "font-semibold" : c.naoLida ? "font-medium text-foreground" : "text-foreground/80")} style={aberta ? { color: NAVY } : undefined}>
                            {c.importante && <Bookmark className="h-3 w-3 shrink-0 fill-current text-amber-500" />}
                            <span className="truncate">{assuntoPt(m) || "(sem assunto)"}</span>
                          </p>
                          <div className="flex items-center gap-1.5">
                            {traduzido(m) && m.subject_pt && <Languages className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-label="Traduzido" />}
                            <p className="truncate text-xs text-muted-foreground flex-1">{trechoPt(m)}</p>
                            {c.anexo && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                            {c.estrela && <Star className="h-3.5 w-3.5 shrink-0 fill-current text-amber-500" />}
                          </div>
                        </button>
                      </div>
                      {/* ações ao passar o mouse */}
                      <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 rounded-md border bg-card shadow-sm p-0.5">
                        <Acao icone={c.naoLida ? MailOpen : Mail} rotulo={c.naoLida ? "Marcar como lida" : "Marcar como não lida"} pequeno onClick={() => marcarLidas([m.thread_id], c.naoLida)} />
                        <Acao icone={Bookmark} rotulo={c.importante ? "Tirar importante" : "Importante"} pequeno ativo={c.importante} onClick={() => marcarImportante([m.thread_id], !c.importante)} />
                        <Acao icone={Star} rotulo={c.estrela ? "Tirar estrela" : "Estrela"} pequeno ativo={c.estrela} onClick={() => marcarEstrela([m.thread_id], !c.estrela)} />
                        {naLixeiraOuSpam ? <Acao icone={Undo2} rotulo="Restaurar" pequeno onClick={() => restaurar([m.thread_id])} /> : <Acao icone={Archive} rotulo="Arquivar" pequeno onClick={() => arquivar([m.thread_id])} />}
                        {pasta !== "TRASH" && <Acao icone={Trash2} rotulo="Excluir" pequeno perigo onClick={() => lixeira([m.thread_id])} />}
                        {naLixeiraOuSpam && <Acao icone={Trash2} rotulo="Excluir definitivamente" pequeno perigo onClick={() => excluirDeVez([m.thread_id])} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
          {todasConversas.length > 0 && (
            <div className="border-t px-2 py-1.5 flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/20">
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" disabled={pagina <= 1} onClick={() => mudarPagina(pagina - 1)}><ChevronLeft className="h-3.5 w-3.5" /> Anterior</Button>
              <span className="tabular-nums flex-1 text-center">Página {pagina} de {totalPaginas}</span>
              <div className="flex items-center rounded-md border bg-card p-0.5" role="group" aria-label="E-mails por página">
                {TAMANHOS_PAGINA.map((n) => (
                  <button key={n} onClick={() => mudarTamanho(n)} className={cn("rounded px-1.5 py-0.5 tabular-nums font-medium transition-colors", POR_PAGINA === n ? "text-white" : "hover:bg-muted")} style={POR_PAGINA === n ? { background: NAVY } : undefined} title={`${n} por página`}>{n}</button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" disabled={pagina >= totalPaginas} onClick={() => mudarPagina(pagina + 1)}>Próxima <ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </section>

        {/* Leitura */}
        <section className={cn("flex-1 min-w-0 flex flex-col", !mobileLendo && "hidden lg:flex")}>
          {!threadSel ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-muted/60"><MailOpen className="h-8 w-8 opacity-40" /></div>
              <p className="text-sm">Escolha uma conversa</p>
              <p className="text-[11px]">Dica: <kbd className="rounded border px-1">j</kbd> e <kbd className="rounded border px-1">k</kbd> navegam, <kbd className="rounded border px-1">?</kbd> mostra os atalhos</p>
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-2.5 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={fecharThread}><ChevronLeft className="h-4 w-4" /></Button>
                <div className="flex-1 min-w-0">
                  <h2 className="truncate font-semibold tracking-tight text-[15px]" style={{ color: NAVY }}>{assuntoThread || "(sem assunto)"}</h2>
                  <p className="text-[11px] text-muted-foreground">{thread.length} {thread.length === 1 ? "mensagem" : "mensagens"}{threadImportante ? " · Importante" : ""}</p>
                </div>
                {leadDoRemetente && (
                  <button onClick={() => navigate(`/crm/leads/${leadDoRemetente.id}`)} className="hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted mr-2" title="Abrir o lead no CRM">
                    <UserRound className="h-3.5 w-3.5" style={{ color: NAVY }} /><span className="font-medium truncate max-w-[180px]">{leadDoRemetente.name}</span>
                    {leadDoRemetente.stage && <Badge variant="secondary" className="text-[10px]">{leadDoRemetente.stage}</Badge>}<ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                {ultimaThread && (
                  <>
                    <Acao icone={Bookmark} rotulo={threadImportante ? "Tirar importante" : "Marcar como importante"} ativo={threadImportante} onClick={() => marcarImportante([ultimaThread.thread_id], !threadImportante)} />
                    <Acao icone={Star} rotulo={threadEstrela ? "Tirar estrela" : "Marcar com estrela"} ativo={threadEstrela} onClick={() => marcarEstrela([ultimaThread.thread_id], !threadEstrela)} />
                    <Acao icone={Mail} rotulo="Marcar como não lida" onClick={() => marcarLidas([ultimaThread.thread_id], false)} />
                    {naLixeiraOuSpam ? (
                      <Acao icone={Undo2} rotulo={pasta === "SPAM" ? "Não é spam" : "Restaurar pra Entrada"} onClick={() => restaurar([ultimaThread.thread_id])} />
                    ) : (
                      <>
                        <Acao icone={Archive} rotulo="Arquivar" onClick={() => arquivar([ultimaThread.thread_id])} />
                        <Acao icone={AlertOctagon} rotulo="Marcar como spam" onClick={() => spam([ultimaThread.thread_id])} />
                      </>
                    )}
                    {pasta !== "TRASH" && <Acao icone={Trash2} rotulo="Excluir (lixeira)" perigo onClick={() => lixeira([ultimaThread.thread_id])} />}
                    {naLixeiraOuSpam && <Acao icone={Trash2} rotulo="Excluir definitivamente" perigo onClick={() => excluirDeVez([ultimaThread.thread_id])} />}
                  </>
                )}
              </div>
              <ScrollArea className="flex-1 bg-muted/30">
                <div className="p-4 space-y-3 max-w-5xl">
                  {thread.map((m, i) => {
                    const aberto = i === thread.length - 1 || thread.length <= 3;
                    return <Mensagem key={m.id} m={m} abertoInicial={aberto} chamar={chamar} onTraduzida={(x) => setThread((p) => p.map((k) => (k.gmail_id === m.gmail_id ? { ...k, ...x } : k)))} onBaixar={(a) => baixarAnexo(m, a)} onEstrela={() => estrelaMsg(m)}
                      onResponder={() => setCompor({ modo: "responder", base: m })} onResponderTodos={() => setCompor({ modo: "todos", base: m })} onEncaminhar={() => setCompor({ modo: "encaminhar", base: m })} />;
                  })}
                  {carregandoThread && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
                </div>
              </ScrollArea>
              {ultimaThread && (
                <div className="border-t p-2.5 flex gap-2 bg-card">
                  <Button className="gap-2 rounded-lg" style={{ background: NAVY }} onClick={() => setCompor({ modo: "responder", base: ultimaThread })}><Reply className="h-4 w-4" /> Responder</Button>
                  <Button variant="outline" className="gap-2 rounded-lg" onClick={() => setCompor({ modo: "todos", base: ultimaThread })}><ReplyAll className="h-4 w-4" /> Responder a todos</Button>
                  <Button variant="outline" className="gap-2 rounded-lg" onClick={() => setCompor({ modo: "encaminhar", base: ultimaThread })}><Forward className="h-4 w-4" /> Encaminhar</Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {compor && <Compor compor={compor} conta={account} onFechar={() => setCompor(null)} chamar={chamar} onEnviado={() => { setCompor(null); if (account) { carregarLista(account); if (threadSel) abrirThread(threadSel); } }} />}

      <Dialog open={mostrarAtalhos} onOpenChange={setMostrarAtalhos}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2" style={{ color: NAVY }}><Keyboard className="h-4 w-4" /> Atalhos de teclado</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {[["j / k", "Próxima / anterior"], ["Enter", "Abrir conversa"], ["x", "Selecionar"], ["e", "Arquivar"], ["#", "Excluir (lixeira)"], ["s", "Estrela"], ["i", "Importante"], ["u", "Marcar não lida"], ["!", "Spam"], ["r", "Responder"], ["c", "Escrever"], ["/", "Buscar"], ["[ / ]", "Página anterior / próxima"], ["Esc", "Limpar / fechar"], ["?", "Esta ajuda"]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 py-0.5"><span className="text-muted-foreground">{v}</span><kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-mono">{k}</kbd></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

// ── Botão de ação com dica ──────────────────────────────────────────────────────────────────────
function Acao({ icone: Icone, rotulo, onClick, ativo, perigo, pequeno }: { icone: typeof Star; rotulo: string; onClick: () => void; ativo?: boolean; perigo?: boolean; pequeno?: boolean }) {
  return (
    <Tooltip><TooltipTrigger asChild>
      <Button variant="ghost" size="icon" className={cn(pequeno ? "h-7 w-7" : "h-8 w-8", perigo && "text-destructive hover:text-destructive", ativo && "text-amber-500 hover:text-amber-600")} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <Icone className={cn(pequeno ? "h-3.5 w-3.5" : "h-4 w-4", ativo && "fill-current")} />
      </Button>
    </TooltipTrigger><TooltipContent>{rotulo}</TooltipContent></Tooltip>
  );
}

// ── Uma mensagem da conversa ────────────────────────────────────────────────────────────────────
function Mensagem({ m, abertoInicial, chamar, onTraduzida, onBaixar, onEstrela, onResponder, onResponderTodos, onEncaminhar }: {
  m: Msg; abertoInicial: boolean; chamar: (b: Record<string, unknown>) => Promise<any>; onTraduzida: (x: Partial<Msg>) => void;
  onBaixar: (a: Msg["attachments"][number]) => void; onEstrela: () => void;
  onResponder: () => void; onResponderTodos: () => void; onEncaminhar: () => void;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [altura, setAltura] = useState(200);
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => { setAberto(abertoInicial); }, [abertoInicial]);
  const ajustar = () => { try { const h = ref.current?.contentWindow?.document?.documentElement?.scrollHeight; if (h) setAltura(Math.min(Math.max(h + 8, 80), 4000)); } catch { /* sandbox */ } };
  const quem = nomeDe(m);
  const anexos = (m.attachments || []).filter((a) => !a.inline);
  // tradução automática ao abrir (só quando o idioma não é português; fica em cache no banco)
  const [verOriginal, setVerOriginal] = useState(false);
  const [traduzindo, setTraduzindo] = useState(false);
  useEffect(() => {
    if (!aberto || !m.body_loaded || m.body_pt || m.translated_at || traduzindo) return;
    let vivo = true;
    setTraduzindo(true);
    chamar({ action: "translate", gmail_id: m.gmail_id })
      .then((r) => { if (vivo && r) onTraduzida({ lang: r.lang, subject_pt: r.subject_pt, body_pt: r.body_pt, translated_at: r.translated_at || new Date().toISOString() }); })
      .catch(() => {}).finally(() => { if (vivo) setTraduzindo(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, m.body_loaded, m.body_pt, m.translated_at, m.gmail_id]);
  const mostrarTraducao = !!m.body_pt && !verOriginal;
  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden transition-shadow", aberto ? "shadow-sm" : "hover:shadow-sm")}>
      <button className="w-full text-left px-4 py-3 flex items-start gap-3" onClick={() => setAberto((v) => !v)}>
        <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-xs font-semibold text-white" style={{ background: corDe(m.from_email || quem) }}>{iniciais(quem)}</AvatarFallback></Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{m.from_name || m.from_email}</span>
            {m.from_name && <span className="text-xs text-muted-foreground truncate hidden sm:inline">&lt;{m.from_email}&gt;</span>}
            {temLabel(m, "IMPORTANT") && <Bookmark className="h-3 w-3 shrink-0 fill-current text-amber-500" />}
            <span className="ml-auto text-[11px] text-muted-foreground shrink-0" title={quandoLongo(m.internal_date)}>{aberto ? quandoLongo(m.internal_date) : quando(m.internal_date)}</span>
            <button onClick={(e) => { e.stopPropagation(); onEstrela(); }} className={cn(m.is_starred ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-500")}><Star className={cn("h-4 w-4", m.is_starred && "fill-current")} /></button>
          </div>
          {aberto ? (
            <p className="text-xs text-muted-foreground truncate">para {(m.to_list || []).map((a) => a.name || a.email).join(", ")}{m.cc_list?.length ? ` · cc ${m.cc_list.map((a) => a.name || a.email).join(", ")}` : ""}</p>
          ) : (
            <p className="text-xs text-muted-foreground truncate">{trechoPt(m)}</p>
          )}
        </div>
      </button>
      {aberto && (
        <>
          {(!!m.body_pt || traduzindo) && (
            <div className="mx-4 mb-1 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: "#0D2B5E0d", color: NAVY }}>
              <Languages className="h-3.5 w-3.5 shrink-0" />
              {traduzindo && !m.body_pt ? (
                <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Traduzindo pra português...</span>
              ) : (
                <>
                  <span>{verOriginal ? `Original em ${NOME_IDIOMA[m.lang || ""] || m.lang}` : `Traduzido do ${NOME_IDIOMA[m.lang || ""] || m.lang}`}</span>
                  <button onClick={() => setVerOriginal((v) => !v)} className="ml-auto font-medium underline-offset-2 hover:underline">{verOriginal ? "Ver tradução" : "Ver original"}</button>
                </>
              )}
            </div>
          )}
          {mostrarTraducao ? (
            <div className="px-6 py-4 text-[14px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">{m.body_pt}</div>
          ) : (
            <iframe ref={ref} title={m.subject || "e-mail"} sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" srcDoc={docDoEmail(m)} onLoad={ajustar} style={{ height: altura }} className="w-full border-0 bg-white" />
          )}
          {anexos.length > 0 && (
            <div className="px-4 pb-3 pt-2 border-t bg-muted/20 flex flex-wrap gap-2">
              {anexos.map((a, i) => { const Ic = iconeDoAnexo(a.mimeType || ""); return (
                <button key={i} onClick={() => onBaixar(a)} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs hover:bg-muted transition-colors">
                  <Ic className="h-4 w-4" style={{ color: NAVY }} /><span className="max-w-[200px] truncate font-medium">{a.filename}</span><span className="text-muted-foreground">{tamanho(a.size || 0)}</span><Download className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ); })}
            </div>
          )}
          <div className="px-4 py-2 border-t flex gap-1.5">
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
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 pt-4 pb-2"><DialogTitle className="text-base tracking-tight" style={{ color: NAVY }}>{titulo}</DialogTitle></DialogHeader>
        <div className="px-5 space-y-2">
          <div className="flex items-center gap-2 border-b"><span className="text-xs text-muted-foreground w-12">Para</span><Input value={para} onChange={(e) => setPara(e.target.value)} placeholder="email@exemplo.com, outro@exemplo.com" className="border-0 shadow-none focus-visible:ring-0 px-0" />{!mostrarCc && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setMostrarCc(true)}>Cc</button>}</div>
          {mostrarCc && <div className="flex items-center gap-2 border-b"><span className="text-xs text-muted-foreground w-12">Cc</span><Input value={cc} onChange={(e) => setCc(e.target.value)} className="border-0 shadow-none focus-visible:ring-0 px-0" /></div>}
          <div className="flex items-center gap-2 border-b"><span className="text-xs text-muted-foreground w-12">Assunto</span><Input value={assunto} onChange={(e) => setAssunto(e.target.value)} className="border-0 shadow-none focus-visible:ring-0 px-0" /></div>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") enviar(); }} placeholder="Escreva aqui..." className="min-h-[240px] border-0 shadow-none focus-visible:ring-0 px-0 resize-y text-[14px] leading-relaxed" autoFocus />
          {b && compor.modo !== "novo" && <p className="text-[11px] text-muted-foreground">A mensagem original vai citada abaixo do seu texto.</p>}
          {anexos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {anexos.map((a, i) => <span key={i} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs"><Paperclip className="h-3 w-3" />{a.filename} <span className="text-muted-foreground">{tamanho(a.size)}</span><button onClick={() => setAnexos((p) => p.filter((_, k) => k !== i))}><X className="h-3 w-3" /></button></span>)}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t flex items-center gap-3 bg-muted/20">
          <Button onClick={enviar} disabled={enviando} className="gap-2 rounded-lg px-5" style={{ background: NAVY }}>{enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar</Button>
          <label className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Paperclip className="h-4 w-4" /> Anexar<input type="file" multiple className="hidden" onChange={(e) => { anexar(e.target.files); e.currentTarget.value = ""; }} /></label>
          <span className="ml-auto text-[11px] text-muted-foreground">de {conta.email} · <kbd className="rounded border px-1">⌘</kbd>+<kbd className="rounded border px-1">Enter</kbd> envia</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
