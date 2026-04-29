import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const revenueOptions = [{ value: "under-50k", label: "Menos de R$ 50k/mês" }, { value: "50k-150k", label: "R$ 50k–150k/mês" }, { value: "150k-400k", label: "R$ 150k–400k/mês" }, { value: "400k-1m", label: "R$ 400k–1M/mês" }, { value: "over-1m", label: "Acima de R$ 1M/mês" }];
const teamSizeOptions = [{ value: "1", label: "1 vendedor" }, { value: "2-3", label: "2–3 vendedores" }, { value: "4-5", label: "4–5 vendedores" }, { value: "6-10", label: "6–10 vendedores" }, { value: "over-10", label: "10+ vendedores" }];
const productOptions = [{ value: "unsure", label: "Não tenho certeza — preciso de orientação" }, { value: "core", label: "UNV Core" }, { value: "control", label: "UNV Control" }, { value: "acceleration", label: "UNV Sales Acceleration" }, { value: "growth-room", label: "UNV Growth Room" }, { value: "partners", label: "UNV Partners" }, { value: "sales-ops", label: "UNV Sales Ops" }];

export default function ApplyPage() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", company: "", website: "", role: "", revenue: "", teamSize: "", product: "", challenge: "", acceptTerms: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.acceptTerms) {
      toast({ title: "Termos obrigatórios", description: "Por favor, aceite os termos para continuar.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("diagnostic_applications").insert({
      full_name: formData.name,
      email: formData.email,
      phone: formData.phone,
      company: formData.company,
      website: formData.website || null,
      role: formData.role || null,
      monthly_revenue: formData.revenue || null,
      team_size: formData.teamSize || null,
      product_interest: formData.product || null,
      main_challenge: formData.challenge,
      accepted_terms: formData.acceptTerms,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: "Tente novamente em instantes.", variant: "destructive" });
      return;
    }
    setIsSubmitted(true);
    toast({ title: "Aplicação enviada", description: "Entraremos em contato em até 48 horas." });
  };

  return (
    <Layout>
      <section className="section-padding bg-gradient-hero"><div className="container-premium"><div className="max-w-3xl mx-auto text-center"><h1 className="heading-display text-primary-foreground mb-6">Aplicar para Diagnóstico</h1><p className="text-xl text-primary-foreground/80">Complete este formulário para iniciar o processo de avaliação. Analisaremos seu perfil e entraremos em contato para agendar uma sessão de diagnóstico.</p></div></div></section>
      <section className="section-padding bg-background">
        <div className="container-premium"><div className="max-w-2xl mx-auto">
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="card-premium p-6 md:p-8"><h2 className="heading-card text-foreground mb-6">Informações de Contato</h2><div className="space-y-6"><div className="grid sm:grid-cols-2 gap-6"><div className="space-y-2"><Label>Nome Completo *</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div><div className="space-y-2"><Label>Email *</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div></div><div className="grid sm:grid-cols-2 gap-6"><div className="space-y-2"><Label>Telefone/WhatsApp *</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required /></div><div className="space-y-2"><Label>Seu Cargo</Label><Input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="ex: CEO, Diretor Comercial" /></div></div></div></div>
              <div className="card-premium p-6 md:p-8"><h2 className="heading-card text-foreground mb-6">Informações da Empresa</h2><div className="space-y-6"><div className="grid sm:grid-cols-2 gap-6"><div className="space-y-2"><Label>Nome da Empresa *</Label><Input value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} required /></div><div className="space-y-2"><Label>Website</Label><Input value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="https://" /></div></div><div className="grid sm:grid-cols-2 gap-6"><div className="space-y-2"><Label>Faturamento Mensal *</Label><Select value={formData.revenue} onValueChange={v => setFormData({...formData, revenue: v})}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{revenueOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tamanho do Time *</Label><Select value={formData.teamSize} onValueChange={v => setFormData({...formData, teamSize: v})}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{teamSizeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div></div></div></div>
              <div className="card-premium p-6 md:p-8"><h2 className="heading-card text-foreground mb-6">Seu Interesse</h2><div className="space-y-6"><div className="space-y-2"><Label>Produto de Interesse</Label><Select value={formData.product} onValueChange={v => setFormData({...formData, product: v})}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{productOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Principal Desafio Comercial *</Label><Textarea value={formData.challenge} onChange={e => setFormData({...formData, challenge: e.target.value})} placeholder="Descreva seu maior desafio de vendas..." rows={4} required /></div></div></div>
              <div className="flex items-start gap-3"><Checkbox id="terms" checked={formData.acceptTerms} onCheckedChange={c => setFormData({...formData, acceptTerms: c === true})} /><Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">Aceito os <Link to="/terms" className="text-accent hover:underline">termos e disclaimers</Link>, incluindo que resultados variam conforme execução, payback é projeção (não garantia), e a UNV fornece direção enquanto o cliente executa.</Label></div>
              <Button type="submit" variant="premium" size="xl" className="w-full">Enviar Aplicação<ArrowRight className="ml-2" /></Button>
            </form>
          ) : (
            <div className="card-highlight p-12 text-center"><div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6"><CheckCircle className="h-8 w-8 text-accent" /></div><h2 className="heading-section text-foreground mb-4">Aplicação Recebida</h2><p className="text-body mb-8 max-w-md mx-auto">Obrigado pelo interesse na UNV. Nossa equipe analisará seu perfil e entrará em contato em até 48 horas para agendar uma sessão de diagnóstico.</p><Link to="/"><Button variant="premium-outline" size="lg">Voltar para Home</Button></Link></div>
          )}
        </div></div>
      </section>
    </Layout>
  );
}
