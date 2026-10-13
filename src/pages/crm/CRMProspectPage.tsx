import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Radar, MessageCircle, ListChecks, X, Building2 } from "lucide-react";
import { toast } from "sonner";
import { ProspeccaoPainel } from "@/components/crm/prospeccao/ProspeccaoPainel";

/**
 * Prospecção B2B (UNV Nexus) — mesma base de CNPJs da Receita Federal e mesma
 * validação de WhatsApp do UNV Sales, sem custo: aqui é operação interna da UNV.
 * A busca roda no UNV Sales (dono da base); os leads nascem direto no Nexus.
 */

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const PORTES = [
  { id: "01", label: "Microempresa (ME)" },
  { id: "03", label: "Pequena empresa (EPP)" },
  { id: "05", label: "Média e grande" },
  { id: "00", label: "Não informado" },
];

export const CRMProspectPage = () => {
  const navigate = useNavigate();
  const { setSelectedOrigin, setSelectedPipeline } = useCRMContext();
  const [aba, setAba] = useState<"buscar" | "painel">("buscar");
  const [cnaeBusca, setCnaeBusca] = useState("");
  const [cnaeOpcoes, setCnaeOpcoes] = useState<{ codigo: string; descricao: string }[]>([]);
  const [cnaes, setCnaes] = useState<{ codigo: string; descricao: string }[]>([]);
  const [uf, setUf] = useState("");
  const [cidadeBusca, setCidadeBusca] = useState("");
  const [cidadeOpcoes, setCidadeOpcoes] = useState<{ codigo: string; nome: string }[]>([]);
  const [cidades, setCidades] = useState<{ codigo: string; nome: string }[]>([]);
  const [portes, setPortes] = useState<string[]>([]);
  // MEI não existe como porte na Receita (porte 01 cobre ME e MEI): o que separa é a
  // natureza jurídica "Empresário (Individual)". Ligado por padrão (22/09/2026).
  const [semMei, setSemMei] = useState(true);
  const [aberturaDe, setAberturaDe] = useState("");
  const [aberturaAte, setAberturaAte] = useState("");
  const [soMatriz, setSoMatriz] = useState(true);
  const [soTelefone, setSoTelefone] = useState(true);
  const [texto, setTexto] = useState("");

  const [contando, setContando] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [teto, setTeto] = useState(false);

  const [modo, setModo] = useState<"lista" | "whatsapp">("whatsapp");
  const [quantidade, setQuantidade] = useState(100);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);

  const filtros = useMemo(() => ({
    cnaes: cnaes.map((c) => c.codigo),
    uf: uf || null,
    municipios: cidades.map((c) => c.codigo),
    portes,
    sem_mei: semMei,
    abertura_de: aberturaDe || null,
    abertura_ate: aberturaAte || null,
    so_matriz: soMatriz,
    so_com_telefone: soTelefone,
    texto: texto.trim() || null,
  }), [cnaes, uf, cidades, portes, semMei, aberturaDe, aberturaAte, soMatriz, soTelefone, texto]);

  useEffect(() => {
    (supabase as any).from("crm_pipelines").select("id, name").eq("is_active", true).order("sort_order")
      .then(({ data }: any) => { setPipelines(data ?? []); if (data?.length && !pipelineId) setPipelineId(data[0].id); });
  }, []);

  // Essas duas RPCs já existem no UNV Sales — chamamos direto pra montar o filtro
  // (a busca em si, com WhatsApp e cobrança, vai pela edge, não por aqui).
  useEffect(() => {
    if (cnaeBusca.trim().length < 3) { setCnaeOpcoes([]); return; }
    const t = setTimeout(async () => {
      const { data } = await (supabase as any).functions.invoke("crm-prospect-search", { body: { action: "cnaes", texto: cnaeBusca.trim() } });
      const ja = new Set(cnaes.map((c) => c.codigo));
      setCnaeOpcoes(((data?.opcoes ?? []) as any[]).filter((c) => !ja.has(c.codigo)).slice(0, 30));
    }, 300);
    return () => clearTimeout(t);
  }, [cnaeBusca, cnaes]);

  // Cidades do estado escolhido (a lista vem do UNV Sales, dono da base)
  useEffect(() => {
    if (!uf || cidadeBusca.trim().length < 2) { setCidadeOpcoes([]); return; }
    const t = setTimeout(async () => {
      const { data } = await (supabase as any).functions.invoke("crm-prospect-search", { body: { action: "municipios", uf, texto: cidadeBusca.trim() } });
      // as já escolhidas continuam na lista, marcadas: dá pra marcar várias de uma vez
      setCidadeOpcoes(((data?.opcoes ?? []) as any[]).slice(0, 60));
    }, 300);
    return () => clearTimeout(t);
  }, [cidadeBusca, uf]);
  // trocou de estado: as cidades do estado anterior não valem mais
  useEffect(() => { setCidades([]); setCidadeBusca(""); setCidadeOpcoes([]); }, [uf]);

  // Quando a edge responde com erro (400, 500), o supabase-js só diz "non-2xx" e
  // esconde o motivo. O motivo de verdade vem no corpo, em error.context.
  const motivoDoErro = async (data: any, error: any, padrao: string) => {
    if (data?.detail) return String(data.detail);
    try {
      const corpo = await error?.context?.json?.();
      if (corpo?.detail) return String(corpo.detail);
    } catch { /* corpo não era JSON */ }
    const msg = String(error?.message || "");
    if (/non-2xx|Failed to send|Failed to fetch/i.test(msg)) {
      return "A busca demorou mais do que o servidor aguenta. Escolha um estado ou diminua a quantidade e tente de novo.";
    }
    return msg || padrao;
  };

  const contar = async () => {
    setContando(true);
    setTotal(null);
    try {
      const { data, error } = await supabase.functions.invoke("crm-prospect-search", { body: { action: "contar", filtros } });
      if (error || data?.error) { toast.error(await motivoDoErro(data, error, "Não foi possível contar.")); return; }
      setTotal(data.total ?? 0);
      setTeto(!!data.teto);
    } finally {
      setContando(false);
    }
  };

  const executar = async () => {
    if (cnaes.length === 0) { toast.error("Escolha o segmento (atividade da empresa) antes de buscar."); setConfirmar(false); return; }
    setExecutando(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-prospect-search", {
        body: { action: "executar", filtros, quantidade, modo, pipeline_id: pipelineId },
      });
      if (error || data?.error) { toast.error(await motivoDoErro(data, error, "A pesquisa falhou. Tente de novo."), { duration: 9000 }); return; }
      setResultado(data);
      setConfirmar(false);
      toast.success(`${data.entregues} empresa(s) entraram no funil ${data.pipeline}.`);
    } finally {
      setExecutando(false);
    }
  };

  // 25/09/2026 (ideia do Fabrício): contar a base inteira é o que demora. A entrega não
  // depende mais disso, basta escolher o funil e a quantidade. Contar virou informação.
  // Segmento é obrigatório (Fabrício, 13/10/2026): sem atividade escolhida a busca traz empresa
  // de todo nicho. Só digitar não filtra, tem que clicar em uma atividade da lista.
  const semSegmento = cnaes.length === 0;
  const digitouSemEscolher = semSegmento && cnaeBusca.trim().length > 0;
  const podeExecutar = !semSegmento && !!pipelineId && quantidade > 0;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Radar className="h-6 w-6 text-primary" /> Prospecção B2B
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Base de CNPJs da Receita Federal, com WhatsApp confirmado. Uso interno da UNV — sem custo.
        </p>
      </div>

      {/* Buscar empresas | Painel (o que a prospecção virou em resposta, reunião e venda) */}
      <div className="flex gap-1 border-b">
        {([["buscar", "Buscar empresas"], ["painel", "Painel"]] as const).map(([k, rotulo]) => (
          <button key={k} type="button" onClick={() => setAba(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${aba === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {rotulo}
          </button>
        ))}
      </div>
      {aba === "painel" && <ProspeccaoPainel />}

      <div className={`grid gap-4 lg:grid-cols-[1fr_360px] ${aba === "painel" ? "hidden" : ""}`}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quem você quer encontrar</CardTitle>
            <CardDescription>Pesquise à vontade — nada aqui gera cobrança.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Segmento (atividade da empresa) <span className="text-destructive">*</span></Label>
              <Input placeholder="Digite pra buscar: contabilidade, clínica, restaurante…"
                className={digitouSemEscolher ? "border-destructive focus-visible:ring-destructive" : undefined}
                value={cnaeBusca} onChange={(e) => setCnaeBusca(e.target.value)} />
              {digitouSemEscolher && (
                <p className="text-xs text-destructive">
                  {cnaeBusca.trim().length < 3
                    ? "Digite pelo menos 3 letras e clique em uma atividade da lista."
                    : cnaeOpcoes.length > 0
                      ? "Só digitar não filtra: clique em uma atividade da lista abaixo pra ela entrar na busca."
                      : "Nenhuma atividade com esse nome. Tente outra palavra (ex.: estética, cabeleireiro, clínica)."}
                </p>
              )}
              {semSegmento && !digitouSemEscolher && (
                <p className="text-xs text-muted-foreground">Obrigatório: escolha pelo menos uma atividade, senão vêm empresas de todos os nichos.</p>
              )}
              {cnaeOpcoes.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-auto text-sm">
                  {cnaeOpcoes.map((c) => (
                    <button key={c.codigo} type="button" className="w-full text-left px-3 py-1.5 hover:bg-muted flex gap-2"
                      onClick={() => { if (!cnaes.find((x) => x.codigo === c.codigo)) setCnaes([...cnaes, c]); setCnaeBusca(""); setCnaeOpcoes([]); }}>
                      <span className="text-muted-foreground tabular-nums w-16 shrink-0">{c.codigo}</span>
                      <span className="flex-1">{c.descricao}</span>
                      {typeof (c as any).qtd === "number" && (
                        <span className="text-xs text-muted-foreground shrink-0">{((c as any).qtd as number).toLocaleString("pt-BR")} empresas</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {cnaes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cnaes.map((c) => (
                    <Badge key={c.codigo} variant="secondary" className="gap-1 pr-1">
                      {c.descricao}
                      <button type="button" onClick={() => setCnaes(cnaes.filter((x) => x.codigo !== c.codigo))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <SearchableSelect
                  value={uf || "__todos__"}
                  onValueChange={(v) => setUf(v === "__todos__" ? "" : v)}
                  placeholder="Todo o Brasil"
                  emptyMessage="Nenhum estado."
                  options={[{ value: "__todos__", label: "Todo o Brasil" }, ...UFS.map((u) => ({ value: u, label: u }))]}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome contém (opcional)</Label>
                <Input placeholder="Ex.: clínica, advocacia" value={texto} onChange={(e) => setTexto(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cidade {uf ? `(${uf})` : ""}</Label>
              <Input placeholder={uf ? "Digite o nome da cidade" : "Escolha o estado primeiro"} disabled={!uf}
                value={cidadeBusca} onChange={(e) => setCidadeBusca(e.target.value)} />
              {cidadeOpcoes.length > 0 && (
                <div className="border rounded-md text-sm">
                  <div className="max-h-48 overflow-auto">
                    {cidadeOpcoes.map((m) => {
                      const marcada = !!cidades.find((x) => x.codigo === m.codigo);
                      return (
                        <label key={m.codigo} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer">
                          <input type="checkbox" className="h-4 w-4 accent-primary" checked={marcada}
                            onChange={() => setCidades(marcada ? cidades.filter((x) => x.codigo !== m.codigo) : [...cidades, m])} />
                          {m.nome}
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
                    <span>Marque quantas quiser. {cidades.length ? `${cidades.length} escolhida(s).` : ""}</span>
                    <button type="button" className="font-medium text-foreground hover:underline"
                      onClick={() => { setCidadeBusca(""); setCidadeOpcoes([]); }}>Pronto</button>
                  </div>
                </div>
              )}
              {cidades.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cidades.map((m) => (
                    <Badge key={m.codigo} variant="secondary" className="gap-1 pr-1">
                      {m.nome}
                      <button type="button" onClick={() => setCidades(cidades.filter((x) => x.codigo !== m.codigo))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
              {!uf && <p className="text-xs text-muted-foreground">Sem cidade marcada, a busca vale pro estado inteiro (ou pro Brasil).</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Porte da empresa</Label>
              <div className="flex flex-wrap gap-4">
                {PORTES.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={portes.includes(p.id)}
                      onCheckedChange={(v) => setPortes(v ? [...portes, p.id] : portes.filter((x) => x !== p.id))} />
                    {p.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Nenhum marcado = todos os portes.</p>
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border p-3">
              <Checkbox checked={semMei} onCheckedChange={(v) => setSemMei(v === true)} className="mt-0.5" />
              <span>
                <span className="font-medium">Sem MEI e empresário individual</span>
                <span className="block text-xs text-muted-foreground">
                  Traz só empresa constituída (LTDA, SA e afins). O MEI não aparece como porte na base da Receita, ele entra como microempresa, então é esta chave que tira ele da lista.
                </span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Aberta a partir de</Label>
                <Input type="date" value={aberturaDe} onChange={(e) => setAberturaDe(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Aberta até</Label>
                <Input type="date" value={aberturaAte} onChange={(e) => setAberturaAte(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={soMatriz} onCheckedChange={(v) => setSoMatriz(!!v)} /> Só matriz
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={soTelefone} onCheckedChange={(v) => setSoTelefone(!!v)} /> Só com telefone
              </label>
            </div>

            <div className="space-y-2">
              <Button variant="outline" onClick={contar} disabled={contando} className="w-full sm:w-auto">
                {contando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {contando ? "Contando..." : "Contar empresas (opcional)"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Contar varre a base inteira e demora. Pra mandar empresas pro funil você não
                precisa disso: escolha o funil e a quantidade ali do lado.
              </p>
              {/* O resultado ficava só numa linha pequena do outro card e passava
                  despercebido depois de esperar alguns segundos (23/09/2026). */}
              {contando && <p className="text-xs text-muted-foreground">Procurando na base da Receita. Em segmento grande isso leva alguns segundos.</p>}
              {!contando && total !== null && (
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-2xl font-semibold">
                    {total < 0 ? "Muitas empresas" : teto ? `${total.toLocaleString("pt-BR")}+` : total.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {total === 0 ? "Nenhuma empresa com esses filtros. Tente tirar algum." :
                     total < 0 ? "A base é grande demais pra contar com esses filtros, mas dá pra mandar pro funil." :
                     teto ? "Paramos de contar aqui. Tem mais empresas do que isso." : "empresas encontradas"}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mandar pro funil</CardTitle>
            <CardDescription>
              {total === null ? "Conte as empresas primeiro." : total < 0 ? "Muitas empresas (a base é grande demais pra contar agora)." : teto ? `Mais de ${total.toLocaleString("pt-BR")} empresas encontradas.` : `${total.toLocaleString("pt-BR")} empresas encontradas.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>O que entregar</Label>
              <button type="button" onClick={() => setModo("whatsapp")}
                className={`w-full text-left rounded-lg border p-3 ${modo === "whatsapp" ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-center gap-2 font-medium text-sm"><MessageCircle className="h-4 w-4 text-emerald-600" /> Só com WhatsApp confirmado</div>
                <p className="text-xs text-muted-foreground mt-1">Confere se o número existe no WhatsApp antes de entregar.</p>
              </button>
              <button type="button" onClick={() => setModo("lista")}
                className={`w-full text-left rounded-lg border p-3 ${modo === "lista" ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-center gap-2 font-medium text-sm"><ListChecks className="h-4 w-4 text-blue-600" /> Lista da Receita</div>
                <p className="text-xs text-muted-foreground mt-1">Dados cadastrais e sócios, sem validar.</p>
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Quantas empresas</Label>
              <Input type="number" min={1} max={1000} value={quantidade}
                onChange={(e) => setQuantidade(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} />
            </div>

            <div className="space-y-1.5">
              <Label>Funil de destino</Label>
              <SearchableSelect
                value={pipelineId}
                onValueChange={setPipelineId}
                placeholder="Escolha o funil"
                emptyMessage="Nenhum funil encontrado."
                options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>

            {semSegmento && (
              <p className="text-xs text-destructive">Escolha o segmento (atividade da empresa) pra liberar a busca.</p>
            )}
            <Button className="w-full" disabled={!podeExecutar || executando} onClick={() => setConfirmar(true)}>
              <Building2 className="h-4 w-4 mr-2" /> Buscar e enviar pro funil
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmar} onOpenChange={(o) => !executando && setConfirmar(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pesquisa</DialogTitle>
            <DialogDescription>
              Até <b>{quantidade}</b> empresas vão entrar no funil <b>{pipelines.find((p) => p.id === pipelineId)?.name}</b>
              {modo === "whatsapp" ? ", só as que tiverem WhatsApp confirmado" : ""}. Sem custo.
              {executando && (
                <span className="block mt-2 text-xs">
                  Em filtro raro a busca pode levar até um minuto. Deixe esta tela aberta.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)} disabled={executando}>Cancelar</Button>
            <Button onClick={executar} disabled={executando}>
              {executando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {executando ? "Buscando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resultado} onOpenChange={(o) => !o && setResultado(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pesquisa concluída</DialogTitle>
            <DialogDescription>
              <b>{resultado?.entregues}</b> empresa(s) entraram no funil <b>{resultado?.pipeline}</b>.
              {resultado?.encontradas > resultado?.entregues && (
                <> {resultado.encontradas - resultado.entregues} já estavam no CRM e não repetiram.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultado(null)}>Fechar</Button>
            <Button onClick={() => {
              setSelectedOrigin(resultado.origin_id ?? null);
              setSelectedPipeline(resultado.pipeline_id ?? null);
              navigate("/crm/pipeline");
            }}>
              Ir para o funil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMProspectPage;
