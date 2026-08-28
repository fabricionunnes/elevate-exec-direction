// Emissão de NFS-e direto no Emissor Nacional: dados fiscais da empresa
// (uma vez) e o formulário da nota. Quem monta e assina a declaração é a
// função nfse-emitir; aqui só coletamos o que o gov exige.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, Settings, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const REGIMES = [
  { v: "1", t: "Não optante pelo Simples" },
  { v: "2", t: "MEI" },
  { v: "3", t: "Microempresa ou EPP (Simples)" },
];
const RETENCOES = [
  { v: "1", t: "ISS não retido" },
  { v: "2", t: "Retido pelo tomador" },
  { v: "3", t: "Retido pelo intermediário" },
];

export function NfseGovDialog({ aberto, onOpenChange, onEmitida }: {
  aberto: boolean; onOpenChange: (v: boolean) => void; onEmitida?: () => void;
}) {
  const [cfg, setCfg] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [modoConfig, setModoConfig] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [emitindo, setEmitindo] = useState(false);

  const [origem, setOrigem] = useState<"cliente" | "avulsa">("cliente");
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [parcelaId, setParcelaId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [servNota, setServNota] = useState({ codigo: "", nbs: "" });   // vazio = usa o padrão
  const [valor, setValor] = useState("");
  const [tomador, setTomador] = useState({
    nome: "", documento: "", email: "", cep: "", municipio: "", logradouro: "", numero: "", bairro: "",
  });

  const carregar = useCallback(async () => {
    const { data } = await (supabase as any).from("nfse_emitter_config").select("*").limit(1).maybeSingle();
    setCfg(data || {
      cnpj: "", razao_social: "", codigo_municipio: "3144805", inscricao_municipal: "",
      codigo_servico: "170601", codigo_nbs: "114011100", aliquota_iss: "", op_simples_nacional: "1", regime_especial: "0",
      tipo_retencao_iss: "1", serie: "1", proximo_numero: 1, ambiente: "2",
    });
    setModoConfig(!data?.codigo_servico);   // sem dados fiscais, começa pela configuração
    setCarregando(false);
  }, []);
  useEffect(() => { if (aberto) carregar(); }, [aberto, carregar]);

  // clientes ativos: a maioria das notas sai de uma cobrança já lançada
  useEffect(() => {
    if (!aberto) return;
    (async () => {
      const { data } = await (supabase as any).from("onboarding_companies")
        .select("id, name, cnpj, email, address_city, address_state, address_zipcode, address, address_number, address_neighborhood")
        .eq("status", "active").order("name");
      setEmpresas(data || []);
    })();
  }, [aberto]);

  // parcelas da empresa escolhida
  useEffect(() => {
    if (!empresaId) { setParcelas([]); setParcelaId(""); return; }
    (async () => {
      const { data } = await (supabase as any).from("company_invoices")
        .select("id, description, amount_cents, due_date, status, installment_number, total_installments")
        .eq("company_id", empresaId).order("due_date", { ascending: false }).limit(40);
      setParcelas(data || []);
    })();
  }, [empresaId]);

  // ao escolher a parcela, preenche a nota com o que já está no sistema
  useEffect(() => {
    const p = parcelas.find((x) => x.id === parcelaId);
    const emp = empresas.find((e) => e.id === empresaId);
    if (!p || !emp) return;
    setValor(((p.amount_cents || 0) / 100).toFixed(2).replace(".", ","));
    const parc = p.installment_number && p.total_installments
      ? ` (parcela ${p.installment_number}/${p.total_installments})` : "";
    setDescricao(`${p.description || "Prestação de serviços"}${parc}`);
    setTomador({
      nome: emp.name || "",
      documento: emp.cnpj || "",
      email: emp.email || "",
      cep: emp.address_zipcode || "",
      municipio: "",
      logradouro: emp.address || "",
      numero: emp.address_number || "",
      bairro: emp.address_neighborhood || "",
    });
  }, [parcelaId, parcelas, empresaId, empresas]);

  const salvarConfig = async () => {
    if (!cfg.cnpj || !cfg.razao_social) { toast.error("Informe CNPJ e razão social"); return; }
    if (!/^\d{6}$/.test(String(cfg.codigo_servico || ""))) {
      toast.error("O código do serviço tem 6 dígitos (ex: 170100 para consultoria)"); return;
    }
    setSalvando(true);
    try {
      const linha = {
        ...cfg,
        cnpj: String(cfg.cnpj).replace(/\D/g, ""),
        aliquota_iss: cfg.aliquota_iss === "" ? null : Number(cfg.aliquota_iss),
        proximo_numero: Number(cfg.proximo_numero || 1),
        updated_at: new Date().toISOString(),
      };
      const { error } = cfg.id
        ? await (supabase as any).from("nfse_emitter_config").update(linha).eq("id", cfg.id)
        : await (supabase as any).from("nfse_emitter_config").insert(linha);
      if (error) throw error;
      toast.success("Dados fiscais salvos");
      setModoConfig(false); carregar();
    } catch (e: any) {
      toast.error(e?.message || "Não consegui salvar");
    } finally { setSalvando(false); }
  };

  const emitir = async () => {
    if (!descricao.trim()) { toast.error("Descreva o serviço"); return; }
    const v = Number(String(valor).replace(/\./g, "").replace(",", "."));
    if (!v || v <= 0) { toast.error("Informe o valor"); return; }
    if (!tomador.nome || !tomador.documento) { toast.error("Informe nome e CPF/CNPJ do tomador"); return; }
    setEmitindo(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfse-emitir", {
        body: {
          descricao, valor: v, tomador,
          codigo_servico: servNota.codigo.trim() || undefined,
          codigo_nbs: servNota.nbs.trim() || undefined,
          company_id: origem === "cliente" ? empresaId || null : null,
          invoice_id: origem === "cliente" ? parcelaId || null : null,
        },
      });
      if (error) {
        const detalhe = await (error as any).context?.json?.().catch(() => null);
        throw new Error(detalhe?.error || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      toast.success(d.ambiente === "2"
        ? `Nota de teste gerada (homologação). Chave: ${d.chave_acesso || "—"}`
        : `NFS-e emitida! Chave: ${d.chave_acesso}`);
      onOpenChange(false); onEmitida?.();
      setDescricao(""); setValor(""); setServNota({ codigo: "", nbs: "" });
      setTomador({ nome: "", documento: "", email: "", cep: "", municipio: "", logradouro: "", numero: "", bairro: "" });
    } catch (e: any) {
      toast.error(e?.message || "Não consegui emitir", { duration: 12000 });
    } finally { setEmitindo(false); }
  };

  const campo = (k: string, rotulo: string, extra: any = {}) => (
    <div>
      <Label className="text-xs">{rotulo}</Label>
      <Input value={cfg?.[k] ?? ""} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modoConfig ? <><Settings className="h-4 w-4" /> Dados fiscais da empresa</>
                        : <><FileText className="h-4 w-4" /> Emitir NFS-e</>}
            {cfg?.ambiente === "2" && <Badge variant="outline" className="border-amber-500/40 text-amber-600">homologação</Badge>}
          </DialogTitle>
          <DialogDescription>
            {modoConfig
              ? "Preenchido uma vez. São os campos que o Emissor Nacional exige do prestador."
              : "A nota é gerada direto no gov.br com o certificado da empresa."}
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : modoConfig ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {campo("cnpj", "CNPJ *", { placeholder: "só números" })}
              {campo("inscricao_municipal", "Inscrição municipal")}
            </div>
            {campo("razao_social", "Razão social *")}
            <div className="grid gap-3 sm:grid-cols-2">
              {campo("codigo_municipio", "Código IBGE do município *")}
              {campo("codigo_servico", "Código do serviço (6 dígitos) *", { placeholder: "170601" })}
            </div>
            {campo("codigo_nbs", "Código NBS (9 dígitos)", { placeholder: "114011100" })}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Regime</Label>
                <Select value={cfg.op_simples_nacional} onValueChange={(v) => setCfg({ ...cfg, op_simples_nacional: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REGIMES.map((r) => <SelectItem key={r.v} value={r.v}>{r.t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {campo("aliquota_iss", "Alíquota ISS (%)", { placeholder: "ex: 2" })}
              <div>
                <Label className="text-xs">Retenção do ISS</Label>
                <Select value={cfg.tipo_retencao_iss} onValueChange={(v) => setCfg({ ...cfg, tipo_retencao_iss: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RETENCOES.map((r) => <SelectItem key={r.v} value={r.v}>{r.t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {campo("serie", "Série")}
              {campo("proximo_numero", "Próximo número", { type: "number" })}
              <div>
                <Label className="text-xs">Ambiente</Label>
                <Select value={cfg.ambiente} onValueChange={(v) => setCfg({ ...cfg, ambiente: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">Homologação (teste)</SelectItem>
                    <SelectItem value="1">Produção (nota real)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Confirme o código do serviço e a alíquota com sua contabilidade — é o que define o imposto na nota.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={origem === "cliente" ? "default" : "outline"}
                onClick={() => setOrigem("cliente")}>Para um cliente</Button>
              <Button type="button" size="sm" variant={origem === "avulsa" ? "default" : "outline"}
                onClick={() => { setOrigem("avulsa"); setEmpresaId(""); setParcelaId(""); }}>Avulsa</Button>
            </div>

            {origem === "cliente" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <SearchableSelect
                    value={empresaId}
                    onValueChange={setEmpresaId}
                    options={empresas.map((e) => ({ value: e.id, label: e.name }))}
                    placeholder="Digite para buscar o cliente"
                    emptyMessage="Nenhum cliente com esse nome"
                  />
                </div>
                <div>
                  <Label className="text-xs">Parcela / cobrança</Label>
                  <SearchableSelect
                    value={parcelaId}
                    onValueChange={setParcelaId}
                    options={parcelas.map((p) => ({
                      value: p.id,
                      label: `${new Date(`${p.due_date}T12:00:00`).toLocaleDateString("pt-BR")} · R$ ${((p.amount_cents || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` +
                        (p.installment_number ? ` · ${p.installment_number}/${p.total_installments}` : "") +
                        (p.status === "paid" ? " · paga" : "") +
                        (p.description ? ` · ${p.description}` : ""),
                    }))}
                    placeholder={empresaId ? (parcelas.length ? "Escolha a parcela" : "Nenhuma cobrança lançada") : "Escolha o cliente antes"}
                    emptyMessage="Nenhuma cobrança encontrada"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Descrição do serviço *</Label>
              <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)}
                placeholder={cfg?.descricao_padrao || "Ex: Consultoria em gestão comercial - agosto/2026"} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Valor (R$) *</Label>
                <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label className="text-xs">CPF/CNPJ do tomador *</Label>
                <Input value={tomador.documento} onChange={(e) => setTomador({ ...tomador, documento: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nome / razão social do tomador *</Label>
              <Input value={tomador.nome} onChange={(e) => setTomador({ ...tomador, nome: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input value={tomador.email} onChange={(e) => setTomador({ ...tomador, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">CEP</Label>
                <Input value={tomador.cep} onChange={(e) => setTomador({ ...tomador, cep: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Código do serviço nesta nota</Label>
                <Input value={servNota.codigo} onChange={(e) => setServNota({ ...servNota, codigo: e.target.value })}
                  placeholder={cfg?.codigo_servico || "170601"} />
              </div>
              <div>
                <Label className="text-xs">NBS nesta nota</Label>
                <Input value={servNota.nbs} onChange={(e) => setServNota({ ...servNota, nbs: e.target.value })}
                  placeholder={cfg?.codigo_nbs || "114011100"} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Em branco usa o padrão dos dados fiscais. Preencha só quando esta nota for de outro serviço.
            </p>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Label className="text-xs">Endereço</Label>
                <Input value={tomador.logradouro} onChange={(e) => setTomador({ ...tomador, logradouro: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Número</Label>
                <Input value={tomador.numero} onChange={(e) => setTomador({ ...tomador, numero: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Cód. município</Label>
                <Input value={tomador.municipio} onChange={(e) => setTomador({ ...tomador, municipio: e.target.value })} placeholder="IBGE" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!modoConfig && (
            <Button variant="outline" className="gap-1.5 mr-auto" onClick={() => setModoConfig(true)}>
              <Settings className="h-3.5 w-3.5" /> Dados fiscais
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {modoConfig ? (
            <Button onClick={salvarConfig} disabled={salvando} className="gap-1.5">
              {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar dados fiscais
            </Button>
          ) : (
            <Button onClick={emitir} disabled={emitindo} className="gap-1.5">
              {emitindo && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Emitir no gov
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
