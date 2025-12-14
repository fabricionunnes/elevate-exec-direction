import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, CheckCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormData { clientName: string; company: string; role: string; revenue: string; teamSize: string; avgTicket: string; leadVolume: string; conversion: string; mainPain: string; urgency: number[]; goal90Days: string; notes: string; }
interface Recommendation { product: string; href: string; reasons: string[]; nextSteps: string[]; }

const revenueOptions = [{ value: "under-50k", label: "Menos de R$ 50k/mês" }, { value: "50k-150k", label: "R$ 50k–150k/mês" }, { value: "150k-400k", label: "R$ 150k–400k/mês" }, { value: "400k-1m", label: "R$ 400k–1M/mês" }, { value: "1m-2m", label: "R$ 1M–2M/mês" }, { value: "over-2m", label: "Acima de R$ 2M/mês" }];
const teamSizeOptions = [{ value: "1", label: "1 vendedor" }, { value: "2-3", label: "2–3 vendedores" }, { value: "4-5", label: "4–5 vendedores" }, { value: "6-10", label: "6–10 vendedores" }, { value: "over-10", label: "10+ vendedores" }];
const leadVolumeOptions = [{ value: "under-50", label: "Menos de 50 leads/mês" }, { value: "50-100", label: "50–100 leads/mês" }, { value: "100-300", label: "100–300 leads/mês" }, { value: "300-500", label: "300–500 leads/mês" }, { value: "over-500", label: "500+ leads/mês" }];
const conversionOptions = [{ value: "under-5", label: "Menos de 5%" }, { value: "5-10", label: "5–10%" }, { value: "10-20", label: "10–20%" }, { value: "20-30", label: "20–30%" }, { value: "over-30", label: "Acima de 30%" }];
const painOptions = [{ value: "no-process", label: "Sem processo de vendas definido" }, { value: "inconsistency", label: "Execução inconsistente" }, { value: "low-conversion", label: "Baixa taxa de conversão" }, { value: "owner-dependent", label: "Dono é o gargalo" }, { value: "team-scaling", label: "Dificuldade de escalar time" }, { value: "lack-direction", label: "Falta de direção comercial" }];

function getRecommendation(data: FormData): Recommendation {
  const { revenue, teamSize, mainPain } = data;
  if (mainPain === "no-process" && ["1", "2-3", "4-5"].includes(teamSize)) return { product: "UNV Core", href: "/core", reasons: ["Você precisa estruturar um processo de vendas", "Tamanho do time ideal para implementação", "Solução rápida para parar de improvisar"], nextSteps: ["Aplicar para diagnóstico", "Avaliaremos seu estado atual", "Receba seu plano Core"] };
  if (mainPain === "inconsistency" && ["50k-150k", "150k-400k"].includes(revenue)) return { product: "UNV Control", href: "/control", reasons: ["Você tem processo mas falta consistência", "Direção recorrente vai manter o momentum", "Cobrança semanal com IA se encaixa"], nextSteps: ["Aplicar para avaliação", "Revisaremos seus sistemas", "Iniciar com check-ins mensais"] };
  if (["6-10", "over-10"].includes(teamSize) && ["team-scaling", "inconsistency"].includes(mainPain)) return { product: "UNV Sales Ops", href: "/sales-ops", reasons: ["Padronização é crítica na sua escala", "Treinamento por cargo vai unificar performance", "Scorecards vão garantir accountability"], nextSteps: ["Aplicar para assessment do time", "Mapearemos sua estrutura", "Implementar trilhas por cargo"] };
  if (["400k-1m", "1m-2m", "over-2m"].includes(revenue) && ["lack-direction", "owner-dependent"].includes(mainPain)) return { product: "UNV Partners", href: "/partners", reasons: ["Você precisa de mentoria estratégica", "Orientação de board vai acelerar decisões", "Rede de pares reduz isolamento"], nextSteps: ["Enviar aplicação Partners", "Avaliaremos fit para o programa", "Iniciar com call estratégico"] };
  if (mainPain === "lack-direction" && ["150k-400k", "400k-1m"].includes(revenue)) return { product: "UNV Growth Room", href: "/growth-room", reasons: ["Você precisa redesenhar sua rota", "Imersão presencial traz clareza rápida", "Sairá com plano de 90 dias"], nextSteps: ["Aplicar para Growth Room", "Completar diagnóstico pré-imersão", "Bloquear 3 dias"] };
  return { product: "UNV Sales Acceleration", href: "/sales-acceleration", reasons: ["Seu perfil se encaixa no programa completo", "Compromisso anual garante transformação", "De quick wins a crescimento escalável"], nextSteps: ["Aplicar para diagnóstico", "Analisaremos sua operação", "Receba proposta customizada"] };
}

export default function ForClosersPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({ clientName: "", company: "", role: "", revenue: "", teamSize: "", avgTicket: "", leadVolume: "", conversion: "", mainPain: "", urgency: [3], goal90Days: "", notes: "" });
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setRecommendation(getRecommendation(formData)); setIsSubmitted(true); };
  const generateWhatsAppSummary = () => recommendation ? `*Resumo Diagnóstico*\n\nCliente: ${formData.clientName}\nEmpresa: ${formData.company}\nFaturamento: ${revenueOptions.find(o => o.value === formData.revenue)?.label || "N/I"}\nTime: ${teamSizeOptions.find(o => o.value === formData.teamSize)?.label || "N/I"}\nDor: ${painOptions.find(o => o.value === formData.mainPain)?.label || "N/I"}\nUrgência: ${formData.urgency[0]}/5\nMeta 90 dias: ${formData.goal90Days || "N/I"}\n\n*Produto Recomendado: ${recommendation.product}*\n\nMotivos:\n${recommendation.reasons.map(r => `• ${r}`).join("\n")}\n\nPróximos Passos:\n${recommendation.nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "";
  const copyToClipboard = () => { navigator.clipboard.writeText(generateWhatsAppSummary()); toast({ title: "Copiado!", description: "Resumo pronto para colar no WhatsApp" }); };

  return (
    <Layout>
      <section className="section-padding bg-secondary">
        <div className="container-premium"><div className="max-w-3xl mx-auto text-center"><div className="inline-block px-4 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-full mb-6">Ferramenta Interna</div><h1 className="heading-display text-foreground mb-6">Diagnóstico de Vendas & Fit de Produto</h1><p className="text-body text-lg">Complete o perfil do cliente para receber uma recomendação personalizada com justificativa e próximos passos.</p></div></div>
      </section>
      <section className="section-padding bg-background">
        <div className="container-premium"><div className="max-w-3xl mx-auto">
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="card-premium p-6 md:p-8"><h2 className="heading-card text-foreground mb-6">Informações do Cliente</h2><div className="grid sm:grid-cols-2 gap-6"><div className="space-y-2"><Label>Nome do Cliente *</Label><Input value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} required /></div><div className="space-y-2"><Label>Empresa *</Label><Input value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} required /></div></div></div>
              <div className="card-premium p-6 md:p-8"><h2 className="heading-card text-foreground mb-6">Perfil da Empresa</h2><div className="grid sm:grid-cols-2 gap-6"><div className="space-y-2"><Label>Faturamento Mensal *</Label><Select value={formData.revenue} onValueChange={v => setFormData({...formData, revenue: v})}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{revenueOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tamanho do Time *</Label><Select value={formData.teamSize} onValueChange={v => setFormData({...formData, teamSize: v})}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{teamSizeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Maior Dor *</Label><Select value={formData.mainPain} onValueChange={v => setFormData({...formData, mainPain: v})}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{painOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Volume de Leads</Label><Select value={formData.leadVolume} onValueChange={v => setFormData({...formData, leadVolume: v})}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{leadVolumeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div></div></div>
              <div className="card-premium p-6 md:p-8"><h2 className="heading-card text-foreground mb-6">Urgência & Objetivos</h2><div className="space-y-6"><div className="space-y-4"><Label>Nível de Urgência (1–5)</Label><div className="flex items-center gap-4"><span className="text-small">Baixa</span><Slider value={formData.urgency} onValueChange={v => setFormData({...formData, urgency: v})} min={1} max={5} step={1} className="flex-1" /><span className="text-small">Alta</span><span className="w-8 text-center font-semibold text-accent">{formData.urgency[0]}</span></div></div><div className="space-y-2"><Label>Objetivo 90 Dias</Label><Textarea value={formData.goal90Days} onChange={e => setFormData({...formData, goal90Days: e.target.value})} placeholder="O que o cliente quer alcançar nos próximos 90 dias?" rows={3} /></div></div></div>
              <Button type="submit" variant="premium" size="xl" className="w-full">Gerar Recomendação<ArrowRight className="ml-2" /></Button>
            </form>
          ) : (
            <div className="space-y-8">
              <div className="card-highlight p-8 md:p-12"><div className="text-center mb-8"><p className="text-small uppercase tracking-wider text-muted-foreground mb-2">Produto Recomendado</p><h2 className="heading-display text-foreground">{recommendation?.product}</h2></div><div className="grid md:grid-cols-2 gap-8"><div><h3 className="font-semibold text-foreground mb-4">Por Que Este Produto</h3><ul className="space-y-3">{recommendation?.reasons.map((r, i) => <li key={i} className="flex items-start gap-3"><CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" /><span className="text-body">{r}</span></li>)}</ul></div><div><h3 className="font-semibold text-foreground mb-4">Próximos Passos</h3><ol className="space-y-3">{recommendation?.nextSteps.map((s, i) => <li key={i} className="flex items-start gap-3"><span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-sm font-medium flex items-center justify-center flex-shrink-0">{i + 1}</span><span className="text-body">{s}</span></li>)}</ol></div></div></div>
              <div className="flex flex-col sm:flex-row gap-4"><Button variant="gold" size="lg" onClick={copyToClipboard} className="flex-1"><Copy className="mr-2 h-4 w-4" />Copiar Resumo para WhatsApp</Button><Button variant="premium-outline" size="lg" onClick={() => { setIsSubmitted(false); setRecommendation(null); }} className="flex-1">Novo Diagnóstico</Button></div>
            </div>
          )}
        </div></div>
      </section>
    </Layout>
  );
}
