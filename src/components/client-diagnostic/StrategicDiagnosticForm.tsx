import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, RotateCcw, Save } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DiagnosticRecord, ProjectContext } from "./StrategicDiagnosticModule";

interface Props {
  projectId: string;
  onSaved: (record: DiagnosticRecord) => void;
  projectContext?: ProjectContext | null;
  editingRecord?: DiagnosticRecord | null;
}

const numberToCurrency = (val: number | null | undefined): string => {
  if (val == null) return "";
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCanaisFromString = (val: string | null): { canais: string[]; outro: string } => {
  if (!val) return { canais: [], outro: "" };
  const known = ["Indicação", "Prospecção ativa", "Tráfego pago", "Orgânico", "Redes sociais"];
  const parts = val.split(", ").map(s => s.trim()).filter(Boolean);
  const canais = parts.filter(p => known.includes(p));
  const outros = parts.filter(p => !known.includes(p));
  return { canais, outro: outros.join(", ") };
};

const parseSocialFrom = (val: string | null): { select: string; outro: string } => {
  const known = ["UNV", "Agência externa", "Freelancer", "Colaborador interno", "O próprio dono", "Ninguém faz"];
  if (!val) return { select: "", outro: "" };
  if (known.includes(val)) return { select: val, outro: "" };
  return { select: "Outro", outro: val };
};

const defaultForm = {
  empresa: "",
  responsavel: "",
  consultor_unv: "",
  data_checkpoint: new Date(),
  tempo_cliente: "",
  segmento: "",
  faturamento_atual: "",
  faturamento_entrada: "",
  margem_lucro: "",
  ticket_medio: "",
  possui_dividas: "",
  controle_financeiro: "",
  gestao_financeira: "",
  usa_contador: "",
  usa_bpo_financeiro: "",
  maior_dor_financeira: "",
  observacoes_financeiras: "",
  consultor_financeiro: "",
  num_vendedores: "",
  meta_vendas: "",
  resultado_ultimo_mes: "",
  taxa_conversao: "",
  possui_sdr: "",
  usa_crm: "",
  tem_script: "",
  principal_canal: [] as string[],
  principal_canal_outro: "",
  maior_dor_comercial: "",
  observacoes_comerciais: "",
  investe_trafego: "",
  quem_gerencia_trafego: "",
  investimento_trafego: "",
  cpl_estimado: "",
  volume_leads: "",
  plataformas_trafego: [] as string[],
  satisfeito_trafego: "",
  acompanha_relatorios: "",
  observacoes_trafego: "",
  quem_faz_social: "",
  quem_faz_social_outro: "",
  investimento_social: "",
  seguidores_instagram: "",
  engajamento_medio: "",
  frequencia_postagens: "",
  redes_ativas: [] as string[],
  identidade_visual: "",
  produz_video: "",
  satisfeito_social: "",
  social_gera_leads: "",
  observacoes_marketing: "",
  principais_dores: "",
  produtos_oferecer: [] as string[],
  proximo_passo: "",
  nivel_urgencia: "",
  potencial_upsell: "",
  observacoes_gerais: "",
};

type FormData = typeof defaultForm;

const SectionBadge = ({ label, color }: { label: string; color: "amber" | "blue" | "red" | "green" }) => {
  const colors = {
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    red: "bg-red-100 text-red-800 border-red-200",
    green: "bg-green-100 text-green-800 border-green-200",
  };
  return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${colors[color]}`}>{label}</span>;
};

const formatCurrency = (value: string): string => {
  const num = value.replace(/\D/g, "");
  if (!num) return "";
  const cents = parseInt(num, 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrencyToNumber = (value: string): number | null => {
  if (!value) return null;
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const CurrencyInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <Label className="text-sm">{label}</Label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        value={value}
        onChange={e => onChange(formatCurrency(e.target.value))}
        className="bg-muted/30 border-border/50 pl-10"
        placeholder="0,00"
        inputMode="numeric"
      />
    </div>
  </div>
);

export function StrategicDiagnosticForm({ projectId, onSaved, projectContext, editingRecord }: Props) {
  const [form, setForm] = useState<FormData>(() => {
    if (editingRecord) {
      const canais = parseCanaisFromString(editingRecord.principal_canal);
      const social = parseSocialFrom(editingRecord.quem_faz_social);
      return {
        ...defaultForm,
        empresa: editingRecord.empresa || "",
        responsavel: editingRecord.responsavel || "",
        consultor_unv: editingRecord.consultor_unv || "",
        data_checkpoint: editingRecord.data_checkpoint ? new Date(editingRecord.data_checkpoint + "T12:00:00") : new Date(),
        tempo_cliente: editingRecord.tempo_cliente || "",
        segmento: editingRecord.segmento || "",
        faturamento_atual: numberToCurrency(editingRecord.faturamento_atual),
        faturamento_entrada: numberToCurrency(editingRecord.faturamento_entrada),
        margem_lucro: editingRecord.margem_lucro?.toString() || "",
        ticket_medio: numberToCurrency(editingRecord.ticket_medio),
        possui_dividas: editingRecord.possui_dividas || "",
        controle_financeiro: editingRecord.controle_financeiro || "",
        gestao_financeira: editingRecord.gestao_financeira || "",
        usa_contador: editingRecord.usa_contador || "",
        usa_bpo_financeiro: editingRecord.usa_bpo_financeiro || "",
        maior_dor_financeira: editingRecord.maior_dor_financeira || "",
        observacoes_financeiras: editingRecord.observacoes_financeiras || "",
        consultor_financeiro: editingRecord.consultor_financeiro || "",
        num_vendedores: editingRecord.num_vendedores?.toString() || "",
        meta_vendas: numberToCurrency(editingRecord.meta_vendas),
        resultado_ultimo_mes: numberToCurrency(editingRecord.resultado_ultimo_mes),
        taxa_conversao: editingRecord.taxa_conversao?.toString() || "",
        possui_sdr: editingRecord.possui_sdr || "",
        usa_crm: editingRecord.usa_crm || "",
        tem_script: editingRecord.tem_script || "",
        principal_canal: canais.canais,
        principal_canal_outro: canais.outro,
        maior_dor_comercial: editingRecord.maior_dor_comercial || "",
        observacoes_comerciais: editingRecord.observacoes_comerciais || "",
        investe_trafego: editingRecord.investe_trafego || "",
        quem_gerencia_trafego: editingRecord.quem_gerencia_trafego || "",
        investimento_trafego: numberToCurrency(editingRecord.investimento_trafego),
        cpl_estimado: numberToCurrency(editingRecord.cpl_estimado),
        volume_leads: editingRecord.volume_leads?.toString() || "",
        plataformas_trafego: editingRecord.plataformas_trafego || [],
        satisfeito_trafego: editingRecord.satisfeito_trafego || "",
        acompanha_relatorios: editingRecord.acompanha_relatorios || "",
        observacoes_trafego: editingRecord.observacoes_trafego || "",
        quem_faz_social: social.select,
        quem_faz_social_outro: social.outro,
        investimento_social: numberToCurrency(editingRecord.investimento_social),
        seguidores_instagram: editingRecord.seguidores_instagram?.toString() || "",
        engajamento_medio: editingRecord.engajamento_medio?.toString() || "",
        frequencia_postagens: editingRecord.frequencia_postagens || "",
        redes_ativas: editingRecord.redes_ativas || [],
        identidade_visual: editingRecord.identidade_visual || "",
        produz_video: editingRecord.produz_video || "",
        satisfeito_social: editingRecord.satisfeito_social || "",
        social_gera_leads: editingRecord.social_gera_leads || "",
        observacoes_marketing: editingRecord.observacoes_marketing || "",
        principais_dores: editingRecord.principais_dores || "",
        produtos_oferecer: editingRecord.produtos_oferecer || [],
        proximo_passo: editingRecord.proximo_passo || "",
        nivel_urgencia: editingRecord.nivel_urgencia || "",
        potencial_upsell: numberToCurrency(editingRecord.potencial_upsell),
        observacoes_gerais: editingRecord.observacoes_gerais || "",
      };
    }
    return {
      ...defaultForm,
      empresa: projectContext?.empresa || "",
      responsavel: projectContext?.responsavel || "",
      consultor_unv: projectContext?.consultor_unv || "",
      tempo_cliente: projectContext?.tempo_cliente || "",
      segmento: projectContext?.segmento || "",
    };
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormData, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleArray = (key: "plataformas_trafego" | "redes_ativas" | "produtos_oferecer" | "principal_canal", val: string) => {
    setForm(prev => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
  };

  const handleSubmit = async () => {
    if (!form.empresa.trim() && !projectContext?.empresa) {
      toast.error("Não foi possível identificar a empresa");
      return;
    }
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const payload: Record<string, any> = {
        project_id: projectId,
        created_by: user.user?.id || null,
        empresa: form.empresa,
        responsavel: form.responsavel || null,
        consultor_unv: form.consultor_unv || null,
        data_checkpoint: format(form.data_checkpoint, "yyyy-MM-dd"),
        tempo_cliente: form.tempo_cliente || null,
        segmento: form.segmento || null,
        faturamento_atual: parseCurrencyToNumber(form.faturamento_atual),
        faturamento_entrada: parseCurrencyToNumber(form.faturamento_entrada),
        margem_lucro: form.margem_lucro ? parseFloat(form.margem_lucro) : null,
        ticket_medio: parseCurrencyToNumber(form.ticket_medio),
        possui_dividas: form.possui_dividas || null,
        controle_financeiro: form.controle_financeiro || null,
        gestao_financeira: form.gestao_financeira || null,
        usa_contador: form.usa_contador || null,
        usa_bpo_financeiro: form.usa_bpo_financeiro || null,
        maior_dor_financeira: form.maior_dor_financeira || null,
        observacoes_financeiras: form.observacoes_financeiras || null,
        consultor_financeiro: form.consultor_financeiro || null,
        num_vendedores: form.num_vendedores ? parseInt(form.num_vendedores) : null,
        meta_vendas: parseCurrencyToNumber(form.meta_vendas),
        resultado_ultimo_mes: parseCurrencyToNumber(form.resultado_ultimo_mes),
        taxa_conversao: form.taxa_conversao ? parseFloat(form.taxa_conversao) : null,
        possui_sdr: form.possui_sdr || null,
        usa_crm: form.usa_crm || null,
        tem_script: form.tem_script || null,
        principal_canal: [...form.principal_canal, ...(form.principal_canal_outro ? [form.principal_canal_outro] : [])].join(", ") || null,
        maior_dor_comercial: form.maior_dor_comercial || null,
        observacoes_comerciais: form.observacoes_comerciais || null,
        investe_trafego: form.investe_trafego || null,
        quem_gerencia_trafego: form.quem_gerencia_trafego || null,
        investimento_trafego: parseCurrencyToNumber(form.investimento_trafego),
        cpl_estimado: parseCurrencyToNumber(form.cpl_estimado),
        volume_leads: form.volume_leads ? parseInt(form.volume_leads) : null,
        plataformas_trafego: form.plataformas_trafego.length > 0 ? form.plataformas_trafego : null,
        satisfeito_trafego: form.satisfeito_trafego || null,
        acompanha_relatorios: form.acompanha_relatorios || null,
        observacoes_trafego: form.observacoes_trafego || null,
        quem_faz_social: form.quem_faz_social === "Outro" ? (form.quem_faz_social_outro || "Outro") : (form.quem_faz_social || null),
        investimento_social: parseCurrencyToNumber(form.investimento_social),
        seguidores_instagram: form.seguidores_instagram ? parseInt(form.seguidores_instagram) : null,
        engajamento_medio: form.engajamento_medio ? parseFloat(form.engajamento_medio) : null,
        frequencia_postagens: form.frequencia_postagens || null,
        redes_ativas: form.redes_ativas.length > 0 ? form.redes_ativas : null,
        identidade_visual: form.identidade_visual || null,
        produz_video: form.produz_video || null,
        satisfeito_social: form.satisfeito_social || null,
        social_gera_leads: form.social_gera_leads || null,
        observacoes_marketing: form.observacoes_marketing || null,
        principais_dores: form.principais_dores || null,
        produtos_oferecer: form.produtos_oferecer.length > 0 ? form.produtos_oferecer : null,
        proximo_passo: form.proximo_passo || null,
        nivel_urgencia: form.nivel_urgencia || null,
        potencial_upsell: parseCurrencyToNumber(form.potencial_upsell),
        observacoes_gerais: form.observacoes_gerais || null,
      };

      let result;
      if (editingRecord?.id) {
        const { id, created_at, created_by, project_id, ...rest } = payload;
        const { data, error } = await (supabase.from("client_strategic_diagnostics" as any).update(rest).eq("id", editingRecord.id).select().single() as any);
        if (error) throw error;
        result = data;
        toast.success("Diagnóstico atualizado com sucesso!");
      } else {
        const { data, error } = await (supabase.from("client_strategic_diagnostics" as any).insert(payload).select().single() as any);
        if (error) throw error;
        result = data;
        toast.success("Diagnóstico salvo com sucesso!");
      }
      onSaved(result as DiagnosticRecord);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const RadioField = ({ label, name, options }: { label: string; name: keyof FormData; options: string[] }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup value={form[name] as string} onValueChange={v => set(name, v)} className="flex flex-wrap gap-3">
        {options.map(opt => (
          <div key={opt} className="flex items-center gap-1.5">
            <RadioGroupItem value={opt} id={`${name}-${opt}`} />
            <Label htmlFor={`${name}-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const CheckboxGroup = ({ label, name, options }: { label: string; name: "plataformas_trafego" | "redes_ativas" | "produtos_oferecer"; options: string[] }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-3">
        {options.map(opt => (
          <div key={opt} className="flex items-center gap-1.5">
            <Checkbox
              id={`${name}-${opt}`}
              checked={(form[name] as string[]).includes(opt)}
              onCheckedChange={() => toggleArray(name, opt)}
            />
            <Label htmlFor={`${name}-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-background rounded-xl border border-border/50 max-w-4xl mx-auto">
      <div className="p-6 border-b border-border/30">
        <h2 className="text-xl font-bold">Check-point Estratégico — UNV</h2>
        <p className="text-sm text-muted-foreground mt-1">Preencha durante a reunião com o cliente</p>
      </div>

      <div className="p-6 space-y-8">
        {/* BLOCK 1 */}
        <section className="space-y-4">
          <h3 className="font-semibold text-base">Identificação do Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Empresa", value: form.empresa },
              { label: "Responsável", value: form.responsavel },
              { label: "Consultor UNV", value: form.consultor_unv },
              { label: "Tempo como cliente", value: form.tempo_cliente },
              { label: "Segmento", value: form.segmento },
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{item.label}</Label>
                <p className="text-sm font-medium">{item.value || "—"}</p>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-sm">Data do check-point</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-muted/30 border-border/50", !form.data_checkpoint && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.data_checkpoint, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.data_checkpoint} onSelect={d => d && set("data_checkpoint", d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </section>

        <hr className="border-border/30" />

        {/* BLOCK 2 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">Financeiro</h3>
            <SectionBadge label="gestão & saúde" color="amber" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CurrencyInput label="Faturamento mensal atual" value={form.faturamento_atual} onChange={v => set("faturamento_atual", v)} />
            <CurrencyInput label="Faturamento quando entrou na UNV" value={form.faturamento_entrada} onChange={v => set("faturamento_entrada", v)} />
            <div className="space-y-1.5">
              <Label className="text-sm">Margem de lucro estimada (%)</Label>
              <Input type="number" value={form.margem_lucro} onChange={e => set("margem_lucro", e.target.value)} className="bg-muted/30 border-border/50" />
            </div>
            <CurrencyInput label="Ticket médio atual" value={form.ticket_medio} onChange={v => set("ticket_medio", v)} />
          </div>
          <RadioField label="Possui dívidas?" name="possui_dividas" options={["Não", "Sim, controlada", "Sim, preocupante"]} />
          <RadioField label="Faz controle financeiro?" name="controle_financeiro" options={["Não", "Básico", "Sistema"]} />
          <div className="space-y-1.5">
            <Label className="text-sm">Quem faz a gestão financeira?</Label>
            <Select value={form.gestao_financeira} onValueChange={v => set("gestao_financeira", v)}>
              <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {["O próprio dono", "Colaborador interno", "Escritório contábil", "Ninguém faz"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <RadioField label="Possui contador?" name="usa_contador" options={["Sim", "Não"]} />
          <RadioField label="Possui BPO financeiro?" name="usa_bpo_financeiro" options={["Sim", "Não", "Tem interesse"]} />
          <RadioField label="Possui consultor financeiro ou tem interesse em contratar?" name="consultor_financeiro" options={["Já possui", "Tem interesse", "Não tem interesse"]} />
          <RadioField label="Maior dor financeira hoje" name="maior_dor_financeira" options={["Fluxo de caixa", "Margem baixa", "Inadimplência", "Custo fixo alto", "Falta de previsibilidade", "Não identifica"]} />
          <div className="space-y-1.5">
            <Label className="text-sm">Observações financeiras</Label>
            <Textarea value={form.observacoes_financeiras} onChange={e => set("observacoes_financeiras", e.target.value)} className="bg-muted/30 border-border/50" rows={3} />
          </div>
        </section>

        <hr className="border-border/30" />

        {/* BLOCK 3 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">Comercial</h3>
            <SectionBadge label="vendas & processo" color="blue" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Número de vendedores ativos</Label>
              <Input type="number" value={form.num_vendedores} onChange={e => set("num_vendedores", e.target.value)} className="bg-muted/30 border-border/50" />
            </div>
            <CurrencyInput label="Meta mensal de vendas" value={form.meta_vendas} onChange={v => set("meta_vendas", v)} />
            <CurrencyInput label="Resultado do último mês" value={form.resultado_ultimo_mes} onChange={v => set("resultado_ultimo_mes", v)} />
            <div className="space-y-1.5">
              <Label className="text-sm">Taxa de conversão estimada (%)</Label>
              <Input type="number" value={form.taxa_conversao} onChange={e => set("taxa_conversao", e.target.value)} className="bg-muted/30 border-border/50" />
            </div>
          </div>
          <RadioField label="Possui SDR / pré-vendas?" name="possui_sdr" options={["Sim", "Não", "Estruturando"]} />
          <RadioField label="Usa CRM?" name="usa_crm" options={["Sim", "Não", "Parcialmente"]} />
          <RadioField label="Tem script de vendas?" name="tem_script" options={["Sim", "Não", "Informal"]} />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Canais de venda (marque todos que se aplicam)</Label>
            <div className="flex flex-wrap gap-3">
              {["Indicação", "Prospecção ativa", "Tráfego pago", "Orgânico", "Redes sociais"].map(opt => (
                <div key={opt} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`canal-${opt}`}
                    checked={(form.principal_canal as string[]).includes(opt)}
                    onCheckedChange={() => toggleArray("principal_canal", opt)}
                  />
                  <Label htmlFor={`canal-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="canal-outro"
                checked={!!form.principal_canal_outro}
                onCheckedChange={(checked) => { if (!checked) set("principal_canal_outro", ""); }}
              />
              <Label htmlFor="canal-outro" className="text-sm font-normal cursor-pointer">Outro:</Label>
              <Input
                value={form.principal_canal_outro}
                onChange={e => set("principal_canal_outro", e.target.value)}
                placeholder="Digite o canal..."
                className="bg-muted/30 border-border/50 h-8 max-w-[200px]"
              />
            </div>
          </div>
          <RadioField label="Maior dor comercial hoje" name="maior_dor_comercial" options={["Falta de leads", "Conversão baixa", "Equipe despreparada", "Ticket médio baixo", "Falta de processo", "Churn alto"]} />
          <div className="space-y-1.5">
            <Label className="text-sm">Observações comerciais</Label>
            <Textarea value={form.observacoes_comerciais} onChange={e => set("observacoes_comerciais", e.target.value)} className="bg-muted/30 border-border/50" rows={3} />
          </div>
        </section>

        <hr className="border-border/30" />

        {/* BLOCK 4 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">Tráfego Pago</h3>
            <SectionBadge label="mídia & performance" color="red" />
          </div>
          <RadioField label="Investe em tráfego pago?" name="investe_trafego" options={["Sim", "Não", "Quer iniciar"]} />
          <div className="space-y-1.5">
            <Label className="text-sm">Quem gerencia?</Label>
            <Select value={form.quem_gerencia_trafego} onValueChange={v => set("quem_gerencia_trafego", v)}>
              <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {["UNV", "Agência externa", "Freelancer", "Interno", "O próprio dono", "Ninguém"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CurrencyInput label="Investimento mensal" value={form.investimento_trafego} onChange={v => set("investimento_trafego", v)} />
            <CurrencyInput label="CPL estimado" value={form.cpl_estimado} onChange={v => set("cpl_estimado", v)} />
            <div className="space-y-1.5">
              <Label className="text-sm">Volume de leads/mês</Label>
              <Input type="number" value={form.volume_leads} onChange={e => set("volume_leads", e.target.value)} className="bg-muted/30 border-border/50" />
            </div>
          </div>
          <CheckboxGroup label="Plataformas utilizadas" name="plataformas_trafego" options={["Meta Ads", "Google Ads", "TikTok Ads", "YouTube Ads", "LinkedIn Ads"]} />
          <RadioField label="Satisfeito com os resultados?" name="satisfeito_trafego" options={["Sim", "Parcialmente", "Não"]} />
          <RadioField label="Acompanha relatórios?" name="acompanha_relatorios" options={["Sim", "Não", "Às vezes"]} />
          <div className="space-y-1.5">
            <Label className="text-sm">Observações sobre tráfego</Label>
            <Textarea value={form.observacoes_trafego} onChange={e => set("observacoes_trafego", e.target.value)} className="bg-muted/30 border-border/50" rows={3} />
          </div>
        </section>

        <hr className="border-border/30" />

        {/* BLOCK 5 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">Marketing & Social Media</h3>
            <SectionBadge label="presença & conteúdo" color="green" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Quem faz o social media?</Label>
            <Select value={form.quem_faz_social} onValueChange={v => set("quem_faz_social", v)}>
              <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {["UNV", "Agência externa", "Freelancer", "Colaborador interno", "O próprio dono", "Ninguém faz", "Outro"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.quem_faz_social === "Outro" && (
              <Input
                value={form.quem_faz_social_outro}
                onChange={e => set("quem_faz_social_outro", e.target.value)}
                placeholder="Digite quem faz..."
                className="bg-muted/30 border-border/50 mt-2"
              />
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CurrencyInput label="Investimento mensal em social" value={form.investimento_social} onChange={v => set("investimento_social", v)} />
            <div className="space-y-1.5">
              <Label className="text-sm">Seguidores no Instagram (aprox.)</Label>
              <Input type="number" value={form.seguidores_instagram} onChange={e => set("seguidores_instagram", e.target.value)} className="bg-muted/30 border-border/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Engajamento médio (%)</Label>
              <Input type="number" value={form.engajamento_medio} onChange={e => set("engajamento_medio", e.target.value)} className="bg-muted/30 border-border/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Frequência de postagens</Label>
            <Select value={form.frequencia_postagens} onValueChange={v => set("frequencia_postagens", v)}>
              <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {["Diária", "3-4x por semana", "1-2x por semana", "Esporadicamente", "Não posta"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <CheckboxGroup label="Redes sociais ativas" name="redes_ativas" options={["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "WhatsApp"]} />
          <RadioField label="Tem identidade visual definida?" name="identidade_visual" options={["Sim", "Parcialmente", "Não"]} />
          <RadioField label="Produz conteúdo de vídeo?" name="produz_video" options={["Sim", "Não", "Quer iniciar"]} />
          <RadioField label="Satisfeito com o resultado do social?" name="satisfeito_social" options={["Sim", "Parcialmente", "Não"]} />
          <RadioField label="Social media gera leads diretos?" name="social_gera_leads" options={["Sim", "Indiretamente", "Não"]} />
          <div className="space-y-1.5">
            <Label className="text-sm">Observações sobre marketing</Label>
            <Textarea value={form.observacoes_marketing} onChange={e => set("observacoes_marketing", e.target.value)} className="bg-muted/30 border-border/50" rows={3} />
          </div>
        </section>

        <hr className="border-border/30" />

        {/* BLOCK 6 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">Diagnóstico Final</h3>
            <SectionBadge label="resumo & encaminhamento" color="blue" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Principais dores identificadas nesta reunião</Label>
            <Textarea value={form.principais_dores} onChange={e => set("principais_dores", e.target.value)} className="bg-muted/30 border-border/50 min-h-[120px]" rows={5} />
          </div>
          <CheckboxGroup
            label="Produto/serviço UNV a oferecer"
            name="produtos_oferecer"
            options={["Tráfego pago", "Social media", "Terceirização SDR", "Consultoria financeira", "Aceleração comercial", "Mastermind", "CRO fracionado"]}
          />
          <div className="space-y-1.5">
            <Label className="text-sm">Próximo passo</Label>
            <Select value={form.proximo_passo} onValueChange={v => set("proximo_passo", v)}>
              <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {["Enviar proposta", "Agendar tutoria temática", "Reunião de apresentação de produto", "Aguardar momento do cliente", "Escalar para Rafael", "Escalar para Fabrício"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <RadioField label="Nível de urgência do cliente" name="nivel_urgencia" options={["Alta", "Média", "Baixa"]} />
          <CurrencyInput label="Potencial de upsell estimado" value={form.potencial_upsell} onChange={v => set("potencial_upsell", v)} />
          <div className="space-y-1.5">
            <Label className="text-sm">Observações gerais do consultor</Label>
            <Textarea value={form.observacoes_gerais} onChange={e => set("observacoes_gerais", e.target.value)} className="bg-muted/30 border-border/50" rows={3} />
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border/30 flex justify-end gap-3">
        <Button variant="outline" onClick={() => setForm({ ...defaultForm })} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Limpar formulário
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="gap-2">
          {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar diagnóstico
        </Button>
      </div>
    </div>
  );
}
