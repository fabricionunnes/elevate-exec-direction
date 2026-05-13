import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Crown, User, Building2, Brain, Search, Calendar, DollarSign, Shield, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import logoUNV from "@/assets/logo-unv.png";

const applicationSchema = z.object({
  // Section 1
  full_name: z.string().min(3, "Nome completo é obrigatório"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone/WhatsApp é obrigatório"),
  company: z.string().min(2, "Nome da empresa é obrigatório"),
  role: z.string().min(1, "Selecione seu cargo"),
  role_other: z.string().optional(),
  
  // Section 2
  monthly_revenue: z.string().min(1, "Selecione o faturamento"),
  company_age: z.string().min(1, "Selecione o tempo de operação"),
  employees_count: z.coerce.number().min(1, "Informe o número de colaboradores"),
  salespeople_count: z.coerce.number().min(0, "Informe o número de vendedores"),
  
  // Section 3
  main_challenge: z.string().min(20, "Descreva seu principal desafio (mínimo 20 caracteres)"),
  upcoming_decision: z.string().min(20, "Descreva a decisão importante (mínimo 20 caracteres)"),
  energy_drain: z.string().min(20, "Descreva o que consome sua energia (mínimo 20 caracteres)"),
  feels_alone: z.string().min(1, "Selecione uma opção"),
  
  // Section 4
  willing_to_share_numbers: z.boolean().refine(val => val === true, {
    message: "É necessário estar disposto a compartilhar números reais"
  }),
  reaction_to_confrontation: z.string().min(20, "Descreva sua reação (mínimo 20 caracteres)"),
  contribution_to_group: z.string().min(20, "Descreva sua contribuição (mínimo 20 caracteres)"),
  validation_or_confrontation: z.string().min(1, "Selecione uma opção"),
  
  // Section 5
  available_for_meetings: z.boolean().refine(val => val === true, {
    message: "Disponibilidade para encontros é obrigatória"
  }),
  understands_mansion_costs: z.boolean().refine(val => val === true, {
    message: "Entendimento sobre custos é obrigatório"
  }),
  agrees_confidentiality: z.boolean().refine(val => val === true, {
    message: "Concordância com confidencialidade é obrigatória"
  }),
  
  // Section 6
  aware_of_investment: z.boolean().refine(val => val === true, {
    message: "Ciência do investimento é obrigatória"
  }),
  why_right_moment: z.string().min(20, "Explique por que este é o momento certo (mínimo 20 caracteres)"),
  success_definition: z.string().min(20, "Descreva o que seria sucesso (mínimo 20 caracteres)"),
  
  // Section 7
  is_decision_maker: z.boolean().refine(val => val === true, {
    message: "Esta declaração é obrigatória"
  }),
  understands_not_operational: z.boolean().refine(val => val === true, {
    message: "Esta declaração é obrigatória"
  }),
  understands_may_be_refused: z.boolean().refine(val => val === true, {
    message: "Esta declaração é obrigatória"
  }),
  commits_confidentiality: z.boolean().refine(val => val === true, {
    message: "Esta declaração é obrigatória"
  }),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

const MastermindApplyPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      company: "",
      role: "",
      role_other: "",
      monthly_revenue: "",
      company_age: "",
      employees_count: 0,
      salespeople_count: 0,
      main_challenge: "",
      upcoming_decision: "",
      energy_drain: "",
      feels_alone: "",
      willing_to_share_numbers: false,
      reaction_to_confrontation: "",
      contribution_to_group: "",
      validation_or_confrontation: "",
      available_for_meetings: false,
      understands_mansion_costs: false,
      agrees_confidentiality: false,
      aware_of_investment: false,
      why_right_moment: "",
      success_definition: "",
      is_decision_maker: false,
      understands_not_operational: false,
      understands_may_be_refused: false,
      commits_confidentiality: false,
    },
  });

  const onSubmit = async (data: ApplicationFormData) => {
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("mastermind_applications")
        .insert({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          role: data.role,
          role_other: data.role_other || null,
          monthly_revenue: data.monthly_revenue,
          company_age: data.company_age,
          employees_count: data.employees_count,
          salespeople_count: data.salespeople_count,
          main_challenge: data.main_challenge,
          upcoming_decision: data.upcoming_decision,
          energy_drain: data.energy_drain,
          feels_alone: data.feels_alone,
          willing_to_share_numbers: data.willing_to_share_numbers,
          reaction_to_confrontation: data.reaction_to_confrontation,
          contribution_to_group: data.contribution_to_group,
          validation_or_confrontation: data.validation_or_confrontation,
          available_for_meetings: data.available_for_meetings,
          understands_mansion_costs: data.understands_mansion_costs,
          agrees_confidentiality: data.agrees_confidentiality,
          aware_of_investment: data.aware_of_investment,
          why_right_moment: data.why_right_moment,
          success_definition: data.success_definition,
          is_decision_maker: data.is_decision_maker,
          understands_not_operational: data.understands_not_operational,
          understands_may_be_refused: data.understands_may_be_refused,
          commits_confidentiality: data.commits_confidentiality,
        });
      
      if (error) throw error;
      
      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting application:", error);
      toast({
        title: "Erro ao enviar aplicação",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg mx-auto text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <img src={logoUNV} alt="UNV" className="h-12 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            Aplicação Recebida
          </h1>
          <div className="bg-muted/50 border border-border rounded-lg p-6 text-left space-y-4">
            <p className="text-muted-foreground">
              Obrigado por aplicar para o <span className="text-foreground font-semibold">UNV Mastermind</span>.
            </p>
            <p className="text-muted-foreground">
              Sua aplicação será analisada com critério.
            </p>
            <p className="text-muted-foreground">
              Caso exista fit, entraremos em contato para uma <span className="text-foreground font-medium">conversa de curadoria</span>.
            </p>
            <p className="text-sm text-primary font-medium border-t border-border pt-4">
              Aplicar não garante vaga.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const roleValue = form.watch("role");

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <img src={logoUNV} alt="UNV" className="h-12 mx-auto mb-6" />
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <Crown className="w-5 h-5" />
            <span className="font-semibold">APLICAÇÃO OFICIAL</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            UNV MASTERMIND
          </h1>
          <p className="text-muted-foreground italic">
            Inner Circle of Business & Commercial Leaders
          </p>
          
          <div className="mt-8 bg-muted/50 border border-border rounded-lg p-4 text-left">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Importante:</span> Preencher esta aplicação não garante vaga. O UNV Mastermind é acessado apenas por curadoria.
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
            
            {/* Section 1: Applicant Data */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">SEÇÃO 1</h2>
                  <p className="text-sm text-muted-foreground">Dados do Aplicante</p>
                </div>
              </div>
              
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail profissional</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="seu@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da sua empresa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo atual</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-2 gap-3"
                        >
                          {["Fundador", "Sócio", "CEO", "Diretor", "Outro"].map((role) => (
                            <div key={role} className="flex items-center space-x-2">
                              <RadioGroupItem value={role} id={`role-${role}`} />
                              <Label htmlFor={`role-${role}`}>{role}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {roleValue === "Outro" && (
                  <FormField
                    control={form.control}
                    name="role_other"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qual cargo?</FormLabel>
                        <FormControl>
                          <Input placeholder="Especifique seu cargo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </section>

            {/* Section 2: Company Info */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">SEÇÃO 2</h2>
                  <p className="text-sm text-muted-foreground">Sobre a Empresa</p>
                </div>
              </div>
              
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="monthly_revenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Faturamento médio mensal atual</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid gap-3"
                        >
                          {[
                            "Abaixo de R$ 300k",
                            "R$ 300k a R$ 500k",
                            "R$ 500k a R$ 1M",
                            "R$ 1M a R$ 3M",
                            "Acima de R$ 3M"
                          ].map((revenue) => (
                            <div key={revenue} className="flex items-center space-x-2">
                              <RadioGroupItem value={revenue} id={`revenue-${revenue}`} />
                              <Label htmlFor={`revenue-${revenue}`}>{revenue}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="company_age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tempo de operação da empresa</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-2 gap-3"
                        >
                          {[
                            "Menos de 2 anos",
                            "2 a 5 anos",
                            "5 a 10 anos",
                            "Mais de 10 anos"
                          ].map((age) => (
                            <div key={age} className="flex items-center space-x-2">
                              <RadioGroupItem value={age} id={`age-${age}`} />
                              <Label htmlFor={`age-${age}`}>{age}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="employees_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de colaboradores diretos</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="salespeople_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de vendedores ativos</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Moment and Challenges */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">SEÇÃO 3</h2>
                  <p className="text-sm text-muted-foreground">Momento e Desafios</p>
                </div>
              </div>
              
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="main_challenge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qual é o principal desafio estratégico que sua empresa enfrenta hoje?</FormLabel>
                      <p className="text-xs text-muted-foreground mb-2">
                        Ex: crescimento travado, excesso de decisões, estrutura quebrando, pessoas, foco, etc.
                      </p>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva seu principal desafio..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="upcoming_decision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qual decisão importante você precisa tomar nos próximos 6 meses?</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva a decisão..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="energy_drain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>O que hoje mais consome sua energia como líder?</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="feels_alone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Você se sente sozinho nas decisões mais importantes da empresa?</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-2 gap-3"
                        >
                          {[
                            "Sim, frequentemente",
                            "Às vezes",
                            "Raramente",
                            "Não"
                          ].map((option) => (
                            <div key={option} className="flex items-center space-x-2">
                              <RadioGroupItem value={option} id={`alone-${option}`} />
                              <Label htmlFor={`alone-${option}`}>{option}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Section 4: Maturity and Posture */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">SEÇÃO 4</h2>
                  <p className="text-sm text-muted-foreground">Maturidade e Postura</p>
                </div>
              </div>
              
              <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground">
                  As perguntas abaixo são <span className="text-foreground font-semibold">essenciais para manter o nível do grupo</span>.
                </p>
              </div>
              
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="willing_to_share_numbers"
                  render={({ field }) => (
                    <FormItem className="bg-muted/20 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel className="text-base font-medium cursor-pointer">
                            Você está disposto a compartilhar números reais do seu negócio em um ambiente confidencial?
                          </FormLabel>
                          <p className="text-xs text-destructive">
                            Se não, a aplicação é automaticamente recusada.
                          </p>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="reaction_to_confrontation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Como você costuma reagir quando é confrontado por alguém experiente que discorda da sua visão?</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva sua reação..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contribution_to_group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>O que você acredita que pode CONTRIBUIR para outros empresários do grupo?</FormLabel>
                      <p className="text-xs text-muted-foreground mb-2">
                        Experiência, aprendizados, erros, visão, etc.
                      </p>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva sua contribuição..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="validation_or_confrontation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Você busca neste Mastermind mais validação ou mais confronto intelectual?</FormLabel>
                      <p className="text-xs text-muted-foreground mb-2">
                        Respostas "validação" tendem à recusa.
                      </p>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid gap-3"
                        >
                          {[
                            "Validação",
                            "Confronto",
                            "Ambos, mas priorizo confronto"
                          ].map((option) => (
                            <div key={option} className="flex items-center space-x-2">
                              <RadioGroupItem value={option} id={`validation-${option}`} />
                              <Label htmlFor={`validation-${option}`}>{option}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Section 5: Availability and Commitment */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">SEÇÃO 5</h2>
                  <p className="text-sm text-muted-foreground">Disponibilidade e Compromisso</p>
                </div>
              </div>
              
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="available_for_meetings"
                  render={({ field }) => (
                    <FormItem className="bg-muted/20 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-base font-medium cursor-pointer">
                          Você tem disponibilidade real para participar dos encontros mensais (online e presenciais)?
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="understands_mansion_costs"
                  render={({ field }) => (
                    <FormItem className="bg-muted/20 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-base font-medium cursor-pointer">
                          Você entende que a Mansão Empresarial envolve custos logísticos por sua conta?
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="agrees_confidentiality"
                  render={({ field }) => (
                    <FormItem className="bg-muted/20 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-base font-medium cursor-pointer">
                          Você concorda com regras rígidas de confidencialidade e postura no grupo?
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Section 6: Investment and Expectation */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">SEÇÃO 6</h2>
                  <p className="text-sm text-muted-foreground">Investimento e Expectativa</p>
                </div>
              </div>
              
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="aware_of_investment"
                  render={({ field }) => (
                    <FormItem className="bg-muted/20 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-base font-medium cursor-pointer">
                          Você está ciente de que o investimento anual do UNV Mastermind é de R$ 50.000?
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="why_right_moment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Por que você acredita que ESTE é o momento certo para entrar em um Mastermind?</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Explique..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="success_definition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>O que tornaria essa experiência um sucesso para você ao final de 12 meses?</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva o que seria sucesso..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Section 7: Final Declaration */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">SEÇÃO 7</h2>
                  <p className="text-sm text-muted-foreground">Declaração Final</p>
                </div>
              </div>
              
              <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-foreground mb-2">
                  Declaração de responsabilidade
                </p>
                <p className="text-xs text-muted-foreground">
                  Marque todas para continuar:
                </p>
              </div>
              
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="is_decision_maker"
                  render={({ field }) => (
                    <FormItem className="bg-muted/20 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-base font-medium cursor-pointer">
                          Declaro que sou decisor na empresa
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="understands_not_operational"
                  render={({ field }) => (
                    <FormItem className="bg-muted/20 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-base font-medium cursor-pointer">
                          Entendo que este não é um programa operacional
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="understands_may_be_refused"
                  render={({ field }) => (
                    <FormItem className="bg-muted/20 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-base font-medium cursor-pointer">
                          Entendo que posso ser recusado mesmo atendendo critérios financeiros
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="commits_confidentiality"
                  render={({ field }) => (
                    <FormItem className="bg-muted/20 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-base font-medium cursor-pointer">
                          Comprometo-me com confidencialidade total
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Submit */}
            <div className="pt-6 border-t border-border">
              <Button 
                type="submit" 
                size="lg" 
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando Aplicação...
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5 mr-2" />
                    Enviar Aplicação
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-4">
                Aplicar não garante vaga. Sua aplicação será analisada com critério.
              </p>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default MastermindApplyPage;
