// Lista por UF do bloco "Onde estão nossos clientes" (Visão geral): abre ao clicar num estado
// do mapa ou numa linha da tabela. Clientes (ganho no CRM + carteira) ou leads do período,
// conforme o toggle, vindos de crm_visao_geral_uf (mesmo recorte por papel e as mesmas regras
// do bloco de estados; total do banco + até 500 linhas). Busca, ordenação por coluna e CSV.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Download, ExternalLink, Search, AlertTriangle } from "lucide-react";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { toast } from "sonner";
import { n, moeda, ThOrdenavel } from "./dashboardShared";

export type TipoListaUf = "clientes" | "leads";
export interface FiltrosUf { from: string; to: string; origin: string | null; campaign: string | null; product: string | null; staff: string | null }

interface Props {
  uf: string | null;
  tipo: TipoListaUf;
  onTipo: (t: TipoListaUf) => void;
  onClose: () => void;
  filtros: FiltrosUf;
  periodoTexto: string;
}

const dataCurta = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("pt-BR") : "-");
const linkLead = (i: any) => (i.lead_id || i.kind === "lead" ? `/crm/leads/${i.lead_id || i.id}` : null);
const linkEmpresa = (i: any) => (i.company_id || i.kind === "company" ? `/onboarding-tasks/companies/${i.company_id || i.id}` : null);
const linkDe = (i: any) => linkLead(i) || linkEmpresa(i) || "#";
// Um cliente casado (lead ganho + empresa em carteira) aparece uma vez só
const TIPO_CLIENTE: Record<string, string> = { ambos: "Ganho no CRM e em carteira", so_crm: "Só ganho no CRM", so_carteira: "Só em carteira" };

export function ClientesUfDialog({ uf, tipo, onTipo, onClose, filtros, periodoTexto }: Props) {
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "valor", dir: "desc" });
  const [filtroTipo, setFiltroTipo] = useState("all");

  useEffect(() => {
    if (!uf) return;
    let vivo = true;
    setCarregando(true); setDados(null);
    (supabase as any).rpc("crm_visao_geral_uf", {
      p_from: filtros.from, p_to: filtros.to, p_uf: uf, p_tipo: tipo,
      p_origin: filtros.origin, p_campaign: filtros.campaign, p_product: filtros.product, p_staff: filtros.staff,
    }).then(({ data, error }: any) => {
      if (!vivo) return;
      if (error) toast.error("Erro ao carregar a lista: " + error.message);
      setDados(data || null); setCarregando(false);
    });
    return () => { vivo = false; };
  }, [uf, tipo, filtros.from, filtros.to, filtros.origin, filtros.campaign, filtros.product, filtros.staff]);
  useEffect(() => { setSort(tipo === "clientes" ? { key: "valor", dir: "desc" } : { key: "data", dir: "desc" }); setBusca(""); setFiltroTipo("all"); }, [tipo, uf]);

  const colunas = tipo === "clientes"
    ? [{ k: "nome", l: "Cliente" }, { k: "cidade", l: "Cidade" }, { k: "tipo", l: "Tipo" }, { k: "closer", l: "Closer / responsável" }, { k: "data", l: "Ganho em" }, { k: "valor", l: "Receita", num: true }, { k: "produto", l: "Produto" }]
    : [{ k: "nome", l: "Lead" }, { k: "cidade", l: "Cidade" }, { k: "origem", l: "Origem" }, { k: "funil", l: "Funil / etapa" }, { k: "dono", l: "Dono" }, { k: "data", l: "Entrada" }, { k: "valor", l: "Valor", num: true }];

  const itens: any[] = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = (dados?.itens || []).filter((i: any) => (tipo !== "clientes" || filtroTipo === "all" || i.tipo === filtroTipo) && (!q || [i.nome, i.empresa, i.cidade, i.closer, i.dono, i.origem, i.funil, i.etapa, i.produto].some((v) => String(v || "").toLowerCase().includes(q))));
    const m = sort.dir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sort.key === "valor") return (n(a.valor) - n(b.valor)) * m;
      if (sort.key === "data") return (new Date(a.data || 0).getTime() - new Date(b.data || 0).getTime()) * m;
      return String(a[sort.key] || "").localeCompare(String(b[sort.key] || ""), "pt-BR") * m;
    });
  }, [dados, busca, sort, filtroTipo, tipo]);
  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "valor" || key === "data" ? "desc" : "asc" }));

  const exportarCsv = () => {
    const cab = tipo === "clientes"
      ? ["Cliente", "Empresa", "Cidade", "Tipo", "Closer / responsavel", "Ganho em", "Receita", "Produto", "Funil", "Link do lead", "Link da empresa"]
      : ["Lead", "Empresa", "Cidade", "Origem", "Funil", "Etapa", "Dono", "Entrada", "Valor", "Link"];
    const linha = (i: any) => tipo === "clientes"
      ? [i.nome, i.empresa, i.cidade, TIPO_CLIENTE[i.tipo] || i.tipo, i.closer, dataCurta(i.data), n(i.valor), i.produto, i.funil, linkLead(i) ? window.location.origin + linkLead(i) : "", linkEmpresa(i) ? window.location.origin + linkEmpresa(i) : ""]
      : [i.nome, i.empresa, i.cidade, i.origem, i.funil, i.etapa, i.dono, dataCurta(i.data), n(i.valor), window.location.origin + linkDe(i)];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cab, ...itens.map(linha)].map((r) => r.map(esc).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tipo}-${String(uf).replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const total = n(dados?.total);
  return (
    <Dialog open={!!uf} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{tipo === "clientes" ? "Clientes" : "Leads"} {uf === "Sem UF" ? "sem UF" : `em ${uf}`}</DialogTitle>
          <DialogDescription>
            {tipo === "clientes"
              ? `Ganhos no CRM Comercial (histórico todo, fora de funis de evento) e empresas ativas em carteira. Lead ganho e empresa que são o mesmo cliente aparecem uma vez só.${uf === "Sem UF" ? " Sem estado no cadastro: vale corrigir." : ""}`
              : `Leads criados em ${periodoTexto}.${uf === "Sem UF" ? " Sem estado no cadastro: vale corrigir." : ""}`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["clientes", "leads"] as TipoListaUf[]).map((t) => (
              <button key={t} type="button" onClick={() => onTipo(t)}
                className={`px-2.5 py-1.5 ${tipo === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {t === "clientes" ? "Clientes" : "Leads do período"}
              </button>
            ))}
          </div>
          {tipo === "clientes" && (
            <div className="w-[230px]">
              <SearchableSelect value={filtroTipo} onChange={setFiltroTipo} options={[
                { value: "all", label: "Todos os tipos" },
                { value: "ambos", label: `${TIPO_CLIENTE.ambos} (${n(dados?.ambos)})` },
                { value: "so_crm", label: `${TIPO_CLIENTE.so_crm} (${n(dados?.so_crm)})` },
                { value: "so_carteira", label: `${TIPO_CLIENTE.so_carteira} (${n(dados?.so_carteira)})` },
              ]} />
            </div>
          )}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-8" placeholder="Buscar por nome, cidade, dono..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {carregando ? "" : `${itens.length.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}${total > (dados?.itens || []).length ? " (500 primeiros carregados)" : ""}`}
            {tipo === "clientes" && dados ? `: ${n(dados.ambos)} no CRM e em carteira, ${n(dados.so_crm)} só no CRM, ${n(dados.so_carteira)} só em carteira` : ""}
          </span>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportarCsv} disabled={!itens.length}><Download className="h-3.5 w-3.5" /> CSV</Button>
        </div>
        <div className="max-h-[55vh] overflow-auto border rounded-md">
          {carregando ? (
            <div className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</div>
          ) : itens.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{total ? "Nada com essa busca." : tipo === "clientes" ? "Nenhum cliente aqui." : "Nenhum lead aqui no período."}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground sticky top-0 bg-background"><tr className="border-b">
                {colunas.map((c) => <ThOrdenavel key={c.k} label={c.l} chave={c.k} sort={sort} onSort={onSort} alinhar={(c as any).num ? "right" : "left"} />)}
                <th></th>
              </tr></thead>
              <tbody>
                {itens.map((i: any) => (
                  <tr key={`${i.kind}-${i.id}`} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-1.5 px-1">
                      <a href={linkDe(i)} target="_blank" rel="noreferrer" className="font-medium hover:underline">{i.nome}</a>
                      {i.empresa && i.empresa !== i.nome && (
                        linkEmpresa(i) && tipo === "clientes"
                          ? <a href={linkEmpresa(i)!} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground ml-1.5 hover:underline" title={i.casado_por ? `Mesma empresa em carteira (casou por ${i.casado_por}). Abre a ficha` : "Abre a ficha da empresa"}>{i.empresa}</a>
                          : <span className="text-xs text-muted-foreground ml-1.5">{i.empresa}</span>
                      )}
                    </td>
                    <td className="text-xs">{i.cidade || <span className="text-muted-foreground">-</span>}</td>
                    {tipo === "clientes" ? (
                      <>
                        <td className="whitespace-nowrap">
                          <Badge variant={i.tipo === "ambos" ? "secondary" : "outline"} className="text-[10px]">{TIPO_CLIENTE[i.tipo] || i.tipo}</Badge>
                          {i.tipo === "so_crm" && <span title="Não há empresa ativa em carteira que corresponda a este ganho (por projeto, telefone ou e-mail). Confira se o cliente foi cadastrado ou se já saiu"><AlertTriangle className="inline h-3 w-3 ml-1 text-amber-500" /></span>}
                        </td>
                        <td className="text-xs">{i.closer || "-"}</td>
                        <td className="text-xs whitespace-nowrap">{dataCurta(i.data)}</td>
                        <td className="text-right tabular-nums">{n(i.valor) ? moeda(i.valor) : "-"}</td>
                        <td className="text-xs">{i.produto || "-"}</td>
                      </>
                    ) : (
                      <>
                        <td className="text-xs">{i.origem}</td>
                        <td className="text-xs">{i.funil} <span className="text-muted-foreground">/ {i.etapa}</span></td>
                        <td className="text-xs">{i.dono || <span className="text-muted-foreground">sem dono</span>}</td>
                        <td className="text-xs whitespace-nowrap">{dataCurta(i.data)}</td>
                        <td className="text-right tabular-nums">{n(i.valor) ? moeda(i.valor) : "-"}</td>
                      </>
                    )}
                    <td className="text-right pr-1 whitespace-nowrap">
                      {linkLead(i) && <a href={linkLead(i)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline mr-2" title="Abrir o lead em nova aba"><ExternalLink className="h-3 w-3" /> lead</a>}
                      {tipo === "clientes" && linkEmpresa(i) && <a href={linkEmpresa(i)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline" title="Abrir a ficha da empresa em nova aba"><ExternalLink className="h-3 w-3" /> empresa</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
