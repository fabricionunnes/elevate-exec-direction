import { useState, useMemo } from "react";
import { Calculator, TrendingUp, DollarSign, AlertTriangle, ArrowRight, BarChart3, Scale, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface ROISimulatorProps {
  productName: string;
  productPrice: string;
  productPriceValue?: number; // numeric value for calculations (annual)
  productSlug: string;
  benefitDescription: string;
  expectedConversionIncrease?: number; // percentage points (e.g., 5 = +5%)
  expectedTicketIncrease?: number; // percentage (e.g., 15 = +15%)
}

export function ROISimulator({
  productName,
  productPrice,
  productPriceValue = 10000,
  productSlug,
  benefitDescription,
  expectedConversionIncrease = 5,
  expectedTicketIncrease = 15,
}: ROISimulatorProps) {
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(100000);
  const [monthlySales, setMonthlySales] = useState<number>(50);
  const [simulatedConversionIncrease, setSimulatedConversionIncrease] = useState<number>(expectedConversionIncrease);
  const [simulatedTicketIncrease, setSimulatedTicketIncrease] = useState<number>(expectedTicketIncrease);

  const calculations = useMemo(() => {
    // Current metrics
    const currentTicket = monthlySales > 0 ? monthlyRevenue / monthlySales : 0;
    
    // Assuming current conversion is baseline (we estimate leads based on typical conversion rate)
    // For simulation purposes, we assume 10% baseline conversion
    const estimatedBaselineConversion = 10;
    const estimatedLeads = monthlySales > 0 ? Math.round(monthlySales / (estimatedBaselineConversion / 100)) : 0;
    
    // Simulated improvements
    const newConversion = estimatedBaselineConversion + simulatedConversionIncrease;
    const newTicket = currentTicket * (1 + simulatedTicketIncrease / 100);
    
    // Projected sales with new conversion
    const projectedSales = Math.round(estimatedLeads * (newConversion / 100));
    
    // New revenue
    const projectedMonthlyRevenue = projectedSales * newTicket;
    
    // Opportunity left on the table
    const monthlyOpportunityLost = projectedMonthlyRevenue - monthlyRevenue;
    const yearlyOpportunityLost = monthlyOpportunityLost * 12;
    
    // Investment vs Return calculation
    const yearlyInvestment = productPriceValue;
    const yearlyReturn = yearlyOpportunityLost;
    const roi = yearlyInvestment > 0 ? ((yearlyReturn - yearlyInvestment) / yearlyInvestment) * 100 : 0;
    const netGain = yearlyReturn - yearlyInvestment;
    const paybackMonths = monthlyOpportunityLost > 0 ? yearlyInvestment / monthlyOpportunityLost : 0;
    
    return {
      currentTicket,
      estimatedLeads,
      estimatedBaselineConversion,
      newConversion,
      newTicket,
      projectedSales,
      projectedMonthlyRevenue,
      monthlyOpportunityLost,
      yearlyOpportunityLost,
      yearlyInvestment,
      yearlyReturn,
      roi,
      netGain,
      paybackMonths,
    };
  }, [monthlyRevenue, monthlySales, simulatedConversionIncrease, simulatedTicketIncrease, productPriceValue]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  return (
    <section className="section-padding bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container-premium">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6 border border-accent/30">
              <Calculator className="h-4 w-4" />
              Simulador de Oportunidade
            </div>
            <h2 className="heading-section text-foreground mb-4">
              Quanto você está deixando na mesa?
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Descubra o potencial de crescimento da sua empresa com pequenas melhorias em conversão e ticket médio.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <div className="space-y-6">
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Seus Números Atuais
                </h3>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="revenue" className="text-foreground font-medium">
                      Faturamento Mensal
                    </Label>
                    <Input
                      id="revenue"
                      type="number"
                      value={monthlyRevenue}
                      onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                      className="text-lg"
                      min={0}
                    />
                    <p className="text-small text-muted-foreground">
                      {formatCurrency(monthlyRevenue)}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="sales" className="text-foreground font-medium">
                      Quantidade de Vendas/Mês
                    </Label>
                    <Input
                      id="sales"
                      type="number"
                      value={monthlySales}
                      onChange={(e) => setMonthlySales(Number(e.target.value))}
                      className="text-lg"
                      min={0}
                    />
                    <p className="text-small text-muted-foreground">
                      {formatNumber(monthlySales)} vendas
                    </p>
                  </div>

                  <div className="p-4 bg-secondary rounded-lg border border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Ticket Médio Calculado:</span>
                      <span className="font-semibold text-foreground text-lg">
                        {formatCurrency(calculations.currentTicket)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  Simule Melhorias
                </h3>
                
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-foreground font-medium">
                        Aumento de Conversão
                      </Label>
                      <span className="text-accent font-semibold">
                        +{simulatedConversionIncrease} pontos percentuais
                      </span>
                    </div>
                    <Slider
                      value={[simulatedConversionIncrease]}
                      onValueChange={(value) => setSimulatedConversionIncrease(value[0])}
                      min={1}
                      max={20}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-small text-muted-foreground">
                      De {calculations.estimatedBaselineConversion}% para {calculations.newConversion}% de conversão
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-foreground font-medium">
                        Aumento de Ticket Médio
                      </Label>
                      <span className="text-accent font-semibold">
                        +{simulatedTicketIncrease}%
                      </span>
                    </div>
                    <Slider
                      value={[simulatedTicketIncrease]}
                      onValueChange={(value) => setSimulatedTicketIncrease(value[0])}
                      min={0}
                      max={50}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-small text-muted-foreground">
                      De {formatCurrency(calculations.currentTicket)} para {formatCurrency(calculations.newTicket)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="space-y-6">
              <div className="card-premium p-6 border-2 border-accent/30 bg-accent/5">
                <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-accent" />
                  Dinheiro que você está deixando na mesa
                </h3>
                
                <div className="space-y-6">
                  <div className="p-6 bg-background rounded-xl border border-border text-center">
                    <p className="text-muted-foreground mb-2">Oportunidade Perdida/Mês</p>
                    <p className="text-3xl md:text-4xl font-bold text-accent">
                      {formatCurrency(calculations.monthlyOpportunityLost)}
                    </p>
                  </div>

                  <div className="p-6 bg-primary/10 rounded-xl border border-primary/30 text-center">
                    <p className="text-muted-foreground mb-2">Oportunidade Perdida/Ano</p>
                    <p className="text-4xl md:text-5xl font-bold text-primary">
                      {formatCurrency(calculations.yearlyOpportunityLost)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Projeção com Melhorias
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Vendas projetadas/mês:</span>
                    <span className="font-medium text-foreground">
                      {formatNumber(calculations.projectedSales)} vendas
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Novo ticket médio:</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(calculations.newTicket)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Faturamento projetado/mês:</span>
                    <span className="font-semibold text-primary text-lg">
                      {formatCurrency(calculations.projectedMonthlyRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Faturamento projetado/ano:</span>
                    <span className="font-semibold text-primary text-lg">
                      {formatCurrency(calculations.projectedMonthlyRevenue * 12)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Investment vs Return Comparison */}
              <div className="card-premium p-6 border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-accent/5">
                <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  Investimento vs Retorno (1 Ano)
                </h3>
                
                <div className="space-y-4">
                  {/* Visual comparison bar */}
                  <div className="relative">
                    <div className="flex gap-4 mb-4">
                      <div className="flex-1 p-4 bg-muted/50 rounded-lg border border-border text-center">
                        <p className="text-small text-muted-foreground mb-1">Você Investe</p>
                        <p className="text-xl md:text-2xl font-bold text-foreground">
                          {formatCurrency(calculations.yearlyInvestment)}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <ArrowRight className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 p-4 bg-primary/10 rounded-lg border border-primary/30 text-center">
                        <p className="text-small text-muted-foreground mb-1">Você Ganha</p>
                        <p className="text-xl md:text-2xl font-bold text-primary">
                          {formatCurrency(calculations.yearlyReturn)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Net Gain */}
                  <div className="p-5 bg-accent/10 rounded-xl border border-accent/30 text-center">
                    <p className="text-muted-foreground mb-2 flex items-center justify-center gap-2">
                      <Zap className="h-4 w-4 text-accent" />
                      Ganho Líquido Projetado/Ano
                    </p>
                    <p className="text-3xl md:text-4xl font-bold text-accent">
                      {formatCurrency(calculations.netGain)}
                    </p>
                    {calculations.roi > 0 && (
                      <p className="text-sm text-accent/80 mt-2">
                        ROI de {Math.round(calculations.roi)}%
                      </p>
                    )}
                  </div>

                  {/* Payback */}
                  {calculations.paybackMonths > 0 && calculations.paybackMonths < 12 && (
                    <div className="p-4 bg-background rounded-lg border border-border text-center">
                      <p className="text-muted-foreground text-sm">
                        ⏱️ Payback projetado em <span className="font-semibold text-foreground">{calculations.paybackMonths.toFixed(1)} meses</span>
                      </p>
                    </div>
                  )}

                  {/* Warning if negative */}
                  {calculations.netGain < 0 && (
                    <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30 text-center">
                      <p className="text-destructive text-sm">
                        ⚠️ Com esses parâmetros, o investimento não se paga. Ajuste os valores ou converse conosco.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-premium p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
                <h3 className="font-semibold text-foreground mb-4">
                  Por que o {productName} faz sentido?
                </h3>
                <p className="text-body mb-4">
                  {benefitDescription}
                </p>
                <div className="p-4 bg-background/80 rounded-lg mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Investimento:</span>
                    <span className="font-semibold text-foreground">{productPrice}</span>
                  </div>
                </div>
                <Link to="/diagnostico">
                  <Button variant="hero" size="lg" className="w-full">
                    Fazer Diagnóstico Gratuito
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border text-center">
            <p className="text-small text-muted-foreground">
              ⚠️ Esta é uma simulação baseada em projeções. Resultados reais dependem de execução, mercado e outros fatores.
              <br />A UNV não garante resultados específicos de faturamento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
