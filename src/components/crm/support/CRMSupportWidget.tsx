// Widget de ajuda e suporte do CRM (botão flutuante + painel), 01/10/2026.
// Substitui o item "Ajuda" que abria um link do site. Tem busca na base de ajuda
// (lista curta mantida aqui mesmo), atalhos e "Falar com o suporte", que grava um
// chamado em crm_support_tickets e avisa o time da UNV pelo sino. Sem WhatsApp.
// Abre pelo botão flutuante, pelo menu do usuário (CRMLayout), por ?suporte=<id> na
// rota ou pelo evento "crm-support-open" (o sino dispara quando o suporte responde).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, ChevronRight, FileText, LifeBuoy, Loader2, MessageSquare, Search, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SupportTicketThread, SUPPORT_STATUS, type SupportTicket } from "./SupportTicketThread";

interface Artigo {
  titulo: string;
  texto: string;
  to?: string;
  rotulo?: string;
  /** true = o link leva pras Configurações (só quem tem acesso vê o botão) */
  config?: boolean;
  /** true = aba exclusiva de master/admin */
  admin?: boolean;
}

// Base de ajuda: respostas curtas sobre onde fica cada coisa no CRM.
const ARTIGOS: Artigo[] = [
  { titulo: "Como criar ou editar um funil e suas etapas", texto: "Em Configurações, aba Pipelines. Lá você cria o funil, adiciona etapas, define a ordem, a cor e quais etapas são de ganho ou perda.", to: "/crm/settings?tab=pipelines", rotulo: "Abrir Pipelines", config: true },
  { titulo: "Como cadastrar origens de lead", texto: "Em Configurações, aba Origens. As origens ficam agrupadas e aparecem na barra lateral de Negócios e Contatos.", to: "/crm/settings?tab=origins", rotulo: "Abrir Origens", config: true },
  { titulo: "Como cadastrar motivos de perda", texto: "Em Configurações, aba Motivos de Perda. O motivo é pedido quando o lead vai pra uma etapa de perda.", to: "/crm/settings?tab=reasons", rotulo: "Abrir Motivos de Perda", config: true },
  { titulo: "Como criar tags", texto: "Em Configurações, aba Tags. Depois é só marcar a tag na ficha do lead ou filtrar por ela em Negócios.", to: "/crm/settings?tab=tags", rotulo: "Abrir Tags", config: true },
  { titulo: "Como cadastrar produtos, planos e preço de tabela", texto: "Em Configurações, aba Produtos. O produto aparece no campo Produto do negócio e na hora de marcar o ganho. Desativar tira da lista sem mexer no que já foi vendido.", to: "/crm/settings?tab=produtos", rotulo: "Abrir Produtos", config: true, admin: true },
  { titulo: "Como cadastrar formas de pagamento e bancos", texto: "Em Configurações, aba Formas de Pagamento. São as opções da aba Negócio da ficha do lead.", to: "/crm/settings?tab=pagamento", rotulo: "Abrir Formas de Pagamento", config: true },
  { titulo: "Como distribuir leads automaticamente entre vendedores", texto: "Em Configurações, aba Distribuição. Lá ficam as regras de rodízio dos leads novos.", to: "/crm/settings?tab=distribution", rotulo: "Abrir Distribuição", config: true, admin: true },
  { titulo: "Como definir metas do time", texto: "Em Configurações, aba Metas.", to: "/crm/settings?tab=goals", rotulo: "Abrir Metas", config: true, admin: true },
  { titulo: "Como ajustar o horário de trabalho e os feriados", texto: "Em Configurações, aba Horário de Trabalho. O tempo de resposta em tempo útil do Dashboard usa esse horário.", to: "/crm/settings?tab=horario", rotulo: "Abrir Horário de Trabalho", config: true, admin: true },
  { titulo: "Como criar tipos de atividade", texto: "Em Configurações, aba Tipos de Atividade. Os tipos aparecem ao criar uma atividade e no filtro da tela de Atividades.", to: "/crm/settings?tab=tipos-atividade", rotulo: "Abrir Tipos de Atividade", config: true, admin: true },
  { titulo: "Como liberar um funil ou o CRM pra um usuário", texto: "Em Configurações, aba Acessos. O acesso por funil fica no botão de acessos de cada pipeline.", to: "/crm/settings?tab=access", rotulo: "Abrir Acessos", config: true, admin: true },
  { titulo: "Como receber leads de um formulário ou de outro sistema", texto: "Em Configurações, aba Formulários, você cria o formulário do funil. Pra integrar outro sistema, gere uma chave em API e Webhooks e use a API de leads.", to: "/crm/settings?tab=forms", rotulo: "Abrir Formulários", config: true, admin: true },
  { titulo: "Como gerar uma chave de API ou configurar um webhook", texto: "Em Configurações, aba API e Webhooks. A chave aparece uma única vez na criação. O webhook avisa outro sistema quando o lead é criado, muda de etapa, é ganho ou perdido.", to: "/crm/settings?tab=api", rotulo: "Abrir API e Webhooks", config: true, admin: true },
  { titulo: "Excluí um lead, funil ou etapa sem querer", texto: "Em Configurações, aba Lixeira, dá pra restaurar em até 7 dias.", to: "/crm/settings?tab=lixeira", rotulo: "Abrir Lixeira", config: true, admin: true },
  { titulo: "Como conectar o WhatsApp", texto: "No menu Mais, em Conexão WhatsApp. Depois de conectar, as conversas chegam em Atendimento.", to: "/crm/conexao-whatsapp", rotulo: "Abrir Conexão WhatsApp" },
  { titulo: "Onde vejo e respondo as conversas", texto: "Em Atendimento. Cada conversa pode ser vinculada a um lead pra ficar no histórico do negócio.", to: "/crm/inbox", rotulo: "Abrir Atendimento" },
  { titulo: "Onde vejo minhas tarefas e follow-ups", texto: "Em Atividades. Dá pra filtrar pelo tipo de atividade.", to: "/crm/activities", rotulo: "Abrir Atividades" },
  { titulo: "Como mover um lead de etapa ou marcar ganho e perda", texto: "Em Negócios, arraste o card pra etapa desejada. Pra ganho, o sistema pede o valor da venda; pra perda, o motivo.", to: "/crm/pipeline", rotulo: "Abrir Negócios" },
  { titulo: "Como criar uma sequência de contatos (cadência)", texto: "No menu Mais, em Cadências.", to: "/crm/cadences", rotulo: "Abrir Cadências" },
  { titulo: "Onde vejo as reuniões agendadas", texto: "No menu Mais, em Reuniões.", to: "/crm/meetings", rotulo: "Abrir Reuniões" },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dataCurta = (iso: string) => format(new Date(iso), "dd/MM HH:mm", { locale: ptBR });

type Tela = "inicio" | "novo" | "lista" | "conversa";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string | null;
  /** staff da UNV (tenant nulo): vê o atalho do Manual de Processos */
  isUnvStaff: boolean;
  isMaster: boolean;
  /** master/admin: enxerga as abas exclusivas das Configurações */
  isAdmin: boolean;
  canSettings: boolean;
  /** master/admin da UNV: atalho pra tela onde o suporte responde */
  isSupportTeam: boolean;
  /** esconde o botão flutuante (Atendimento: o canto é do botão de enviar) */
  hideLauncher?: boolean;
}

export function CRMSupportWidget({ open, onOpenChange, staffId, isUnvStaff, isMaster, isAdmin, canSettings, isSupportTeam, hideLauncher }: Props) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tela, setTela] = useState<Tela>("inicio");
  const [busca, setBusca] = useState("");
  const [artigoAberto, setArtigoAberto] = useState<string | null>(null);
  const [chamados, setChamados] = useState<SupportTicket[]>([]);
  const [atualId, setAtualId] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [enviando, setEnviando] = useState(false);

  const carregarChamados = useCallback(async () => {
    if (!staffId) return;
    const { data } = await (supabase as any)
      .from("crm_support_tickets")
      .select("id, staff_id, subject, message, page_url, status, created_at, updated_at")
      .eq("staff_id", staffId)
      .order("updated_at", { ascending: false })
      .limit(30);
    setChamados((data as SupportTicket[]) || []);
  }, [staffId]);

  useEffect(() => { if (open) carregarChamados(); }, [open, carregarChamados]);

  const abrirChamado = useCallback((id: string) => {
    setAtualId(id);
    setTela("conversa");
    onOpenChange(true);
  }, [onOpenChange]);

  // ?suporte=<id> (link da notificação): abre a conversa e limpa o parâmetro
  useEffect(() => {
    const id = searchParams.get("suporte");
    if (!id) return;
    abrirChamado(id);
    const next = new URLSearchParams(searchParams);
    next.delete("suporte");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, abrirChamado]);

  // o sino dispara este evento ao clicar numa resposta do suporte
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent).detail?.ticketId;
      if (id) abrirChamado(id); else { setTela("inicio"); onOpenChange(true); }
    };
    window.addEventListener("crm-support-open", h);
    return () => window.removeEventListener("crm-support-open", h);
  }, [abrirChamado, onOpenChange]);

  const artigos = useMemo(() => {
    const visiveis = ARTIGOS.filter((a) => !a.admin || isAdmin);
    const termos = semAcento(busca).split(/\s+/).filter(Boolean);
    if (!termos.length) return visiveis.slice(0, 6);
    return visiveis.filter((a) => {
      const alvo = semAcento(`${a.titulo} ${a.texto}`);
      return termos.every((t) => alvo.includes(t));
    });
  }, [busca, isAdmin]);

  const enviarChamado = async () => {
    if (!form.subject.trim() || !form.message.trim()) { toast.error("Preencha o assunto e a mensagem"); return; }
    setEnviando(true);
    const { data, error } = await (supabase as any).rpc("crm_support_ticket_open", {
      p_subject: form.subject.trim(),
      p_message: form.message.trim(),
      p_page_url: `${location.pathname}${location.search}`,
    });
    setEnviando(false);
    if (error || !data) { toast.error(`Não consegui abrir o chamado: ${error?.message || "resposta vazia"}`); return; }
    toast.success("Chamado aberto. O suporte foi avisado e responde por aqui.");
    setForm({ subject: "", message: "" });
    await carregarChamados();
    setAtualId(data as string);
    setTela("conversa");
  };

  const atual = chamados.find((c) => c.id === atualId) || null;
  const emAberto = chamados.filter((c) => c.status !== "closed").length;
  const respondidos = chamados.filter((c) => c.status === "answered").length;
  const fechar = () => onOpenChange(false);
  const podeAbrirLink = (a: Artigo) => !!a.to && (!a.config || canSettings);

  if (!staffId) return null;

  const titulos: Record<Tela, string> = { inicio: "Ajuda e suporte", novo: "Falar com o suporte", lista: "Meus chamados", conversa: "Chamado" };

  return (
    <>
      {!hideLauncher && !open && (
        <button
          type="button"
          onClick={() => { setTela("inicio"); onOpenChange(true); }}
          title="Ajuda e suporte"
          className="fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <LifeBuoy className="h-5 w-5" />
          {respondidos > 0 && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-background" />}
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-[55] w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100dvh-6rem)] rounded-xl border border-border bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
            {tela !== "inicio" && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTela(tela === "conversa" ? "lista" : "inicio")} title="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <LifeBuoy className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold flex-1">{titulos[tela]}</p>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={fechar} title="Fechar"><X className="h-4 w-4" /></Button>
          </div>

          {tela === "inicio" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar na ajuda (ex.: funil, meta, WhatsApp)" value={busca} onChange={(e) => { setBusca(e.target.value); setArtigoAberto(null); }} />
              </div>

              <div className="space-y-1">
                <p className="text-[11px] uppercase text-muted-foreground">{busca.trim() ? "Resultados" : "Dúvidas comuns"}</p>
                {artigos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Não achei nada sobre isso. Fale com o suporte logo abaixo.</p>
                ) : artigos.map((a) => (
                  <div key={a.titulo} className="rounded-md border border-border">
                    <button type="button" className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-muted/60 rounded-md" onClick={() => setArtigoAberto(artigoAberto === a.titulo ? null : a.titulo)}>
                      <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", artigoAberto === a.titulo && "rotate-90")} />
                      <span>{a.titulo}</span>
                    </button>
                    {artigoAberto === a.titulo && (
                      <div className="px-3 pb-2.5 pl-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{a.texto}</p>
                        {podeAbrirLink(a) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                            <Link to={a.to!} onClick={fechar}>{a.rotulo || "Abrir"}</Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {(isMaster || isUnvStaff || isSupportTeam) && (
                <div className="space-y-1">
                  <p className="text-[11px] uppercase text-muted-foreground">Atalhos</p>
                  {isMaster && (
                    <Link to="/crm/api" onClick={fechar} className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-muted/60">
                      <FileText className="h-4 w-4 text-muted-foreground" />Documentação da API
                    </Link>
                  )}
                  {isUnvStaff && (
                    <Link to="/processos" onClick={fechar} className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-muted/60">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />Manual de Processos
                    </Link>
                  )}
                  {isSupportTeam && (
                    <Link to="/crm/settings?tab=suporte" onClick={fechar} className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-muted/60">
                      <Settings className="h-4 w-4 text-muted-foreground" />Chamados do time (responder)
                    </Link>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <Button className="w-full" onClick={() => setTela("novo")}>
                  <MessageSquare className="h-4 w-4 mr-2" />Falar com o suporte
                </Button>
                {chamados.length > 0 && (
                  <Button variant="outline" className="w-full" onClick={() => setTela("lista")}>
                    Meus chamados{emAberto > 0 ? ` (${emAberto} em aberto)` : ""}
                  </Button>
                )}
              </div>
            </div>
          )}

          {tela === "novo" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <p className="text-xs text-muted-foreground">Conte o que aconteceu. O time de suporte da UNV recebe o aviso e responde por aqui mesmo.</p>
              <div>
                <Label>Assunto</Label>
                <Input className="mt-1" autoFocus maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ex.: não consigo mover o lead de etapa" />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea className="mt-1" rows={7} maxLength={5000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="O que você tentou fazer, o que apareceu na tela e, se souber, com qual lead." />
              </div>
              <p className="text-[11px] text-muted-foreground">A tela em que você está ({location.pathname}) vai junto pra ajudar o suporte.</p>
              <Button className="w-full" onClick={enviarChamado} disabled={enviando}>
                {enviando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Abrir chamado
              </Button>
            </div>
          )}

          {tela === "lista" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chamados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Você ainda não abriu nenhum chamado.</p>
              ) : chamados.map((c) => {
                const st = SUPPORT_STATUS[c.status] || SUPPORT_STATUS.open;
                return (
                  <button key={c.id} type="button" className="w-full text-left rounded-md border border-border px-3 py-2 hover:bg-muted/60" onClick={() => { setAtualId(c.id); setTela("conversa"); }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">{c.subject}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", st.className)}>{st.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Atualizado em {dataCurta(c.updated_at)}</p>
                  </button>
                );
              })}
              <Button className="w-full" variant="outline" onClick={() => setTela("novo")}>Abrir novo chamado</Button>
            </div>
          )}

          {tela === "conversa" && (
            atual ? (
              <div className="flex-1 min-h-0">
                <SupportTicketThread ticket={atual} viewerIsSupport={false} onChanged={carregarChamados} compact />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-sm text-muted-foreground text-center">Não achei este chamado entre os seus.</p>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
