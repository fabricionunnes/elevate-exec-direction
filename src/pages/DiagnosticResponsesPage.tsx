import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  RefreshCw, 
  Search, 
  Phone, 
  Mail, 
  Building2, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  X
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DiagnosticResponse {
  id: string;
  created_at: string;
  company_name: string;
  contact_name: string;
  whatsapp: string;
  email: string | null;
  revenue: string;
  team_size: string;
  main_pain: string;
  has_sales_process: boolean;
  biggest_challenge: string | null;
  urgency: string;
  recommended_product: string | null;
  status: string;
  notes: string | null;
}

const revenueLabels: Record<string, string> = {
  "menos-50k": "< R$ 50k",
  "50k-100k": "R$ 50k-100k",
  "100k-200k": "R$ 100k-200k",
  "200k-500k": "R$ 200k-500k",
  "500k-1m": "R$ 500k-1M",
  "acima-1m": "> R$ 1M",
};

const painLabels: Record<string, string> = {
  "sem-processo": "Sem processo comercial",
  "inconsistencia": "Vendas inconsistentes",
  "time-desalinhado": "Time desalinhado",
  "poucos-leads": "Poucos leads",
  "conversao-baixa": "Conversão baixa",
  "escala": "Dificuldade escalar",
  "autoridade": "Falta autoridade",
  "lideranca-fraca": "Liderança fraca",
};

const teamLabels: Record<string, string> = {
  "sozinho": "Vende sozinho",
  "1-3": "1 a 3 vendedores",
  "4-10": "4 a 10 vendedores",
  "11-20": "11 a 20 vendedores",
  "20+": "Mais de 20 vendedores",
};

const urgencyLabels: Record<string, string> = {
  "imediata": "Urgente",
  "alta": "Alta (30d)",
  "normal": "Normal (90d)",
  "exploratoria": "Explorando",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600",
  contacted: "bg-blue-500/20 text-blue-600",
  qualified: "bg-emerald-500/20 text-emerald-600",
  closed: "bg-accent/20 text-accent",
  lost: "bg-destructive/20 text-destructive",
};

export default function DiagnosticResponsesPage() {
  const [responses, setResponses] = useState<DiagnosticResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<DiagnosticResponse | null>(null);

  const ACCESS_CODE = "unv2024"; // Código de acesso simples

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_diagnostics")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error("Erro ao buscar respostas:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchResponses();
    }
  }, [isAuthenticated]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("client_diagnostics")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      
      setResponses(prev => 
        prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
      );
      toast.success("Status atualizado");
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar");
    }
  };

  const filteredResponses = responses.filter(r => 
    r.company_name.toLowerCase().includes(search.toLowerCase()) ||
    r.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    r.whatsapp.includes(search)
  );

  if (!isAuthenticated) {
    return (
      <Layout>
        <section className="section-padding bg-background min-h-screen flex items-center justify-center">
          <div className="max-w-md w-full p-8 card-premium">
            <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
              Área Restrita
            </h1>
            <p className="text-muted-foreground text-center mb-6">
              Digite o código de acesso para visualizar as respostas dos diagnósticos.
            </p>
            <div className="space-y-4">
              <Input
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Código de acesso"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && accessCode === ACCESS_CODE) {
                    setIsAuthenticated(true);
                  }
                }}
              />
              <Button 
                className="w-full" 
                onClick={() => {
                  if (accessCode === ACCESS_CODE) {
                    setIsAuthenticated(true);
                  } else {
                    toast.error("Código inválido");
                  }
                }}
              >
                Acessar
              </Button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Respostas do Diagnóstico
              </h1>
              <p className="text-muted-foreground">
                {responses.length} respostas recebidas
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" onClick={fetchResponses} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="text-center py-20">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma resposta encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Dor</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResponses.map((response) => (
                    <TableRow key={response.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(response.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{response.company_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{response.contact_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {response.whatsapp}
                          </div>
                          {response.email && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {response.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <p>{revenueLabels[response.revenue] || response.revenue}</p>
                          <p className="text-muted-foreground">{response.team_size}</p>
                          {response.has_sales_process && (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Tem processo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="secondary" className="text-xs">
                            {painLabels[response.main_pain] || response.main_pain}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs block w-fit",
                              response.urgency === "imediata" && "border-destructive text-destructive",
                              response.urgency === "alta" && "border-orange-500 text-orange-500"
                            )}
                          >
                            {urgencyLabels[response.urgency] || response.urgency}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-accent text-accent-foreground">
                          {response.recommended_product}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <select
                          value={response.status}
                          onChange={(e) => updateStatus(response.id, e.target.value)}
                          className={cn(
                            "px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer",
                            statusColors[response.status] || "bg-secondary"
                          )}
                        >
                          <option value="pending">Pendente</option>
                          <option value="contacted">Contatado</option>
                          <option value="qualified">Qualificado</option>
                          <option value="closed">Fechado</option>
                          <option value="lost">Perdido</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedResponse(response)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const phone = response.whatsapp.replace(/\D/g, "");
                              const text = `Olá ${response.contact_name}! Recebi seu diagnóstico da ${response.company_name}. Vamos conversar sobre o ${response.recommended_product}?`;
                              window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
                            }}
                            title="WhatsApp"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-accent" />
              {selectedResponse?.company_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedResponse && (
            <div className="space-y-6 mt-4">
              {/* Contato */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Contato</p>
                  <p className="font-semibold text-foreground">{selectedResponse.contact_name}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">WhatsApp</p>
                  <p className="font-semibold text-foreground">{selectedResponse.whatsapp}</p>
                </div>
                {selectedResponse.email && (
                  <div className="bg-secondary/50 rounded-lg p-4 sm:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">E-mail</p>
                    <p className="font-semibold text-foreground">{selectedResponse.email}</p>
                  </div>
                )}
              </div>

              {/* Perfil */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Perfil da Empresa</h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Faturamento</p>
                    <p className="font-medium text-foreground">{revenueLabels[selectedResponse.revenue] || selectedResponse.revenue}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Time</p>
                    <p className="font-medium text-foreground">{teamLabels[selectedResponse.team_size] || selectedResponse.team_size}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Processo</p>
                    <p className="font-medium text-foreground">{selectedResponse.has_sales_process ? "Tem processo" : "Sem processo"}</p>
                  </div>
                </div>
              </div>

              {/* Dores */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Dores Identificadas</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedResponse.main_pain.split(',').map((pain, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {painLabels[pain.trim()] || pain.trim()}
                    </Badge>
                  ))}
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-sm",
                      selectedResponse.urgency === "imediata" && "border-destructive text-destructive",
                      selectedResponse.urgency === "alta" && "border-orange-500 text-orange-500"
                    )}
                  >
                    {urgencyLabels[selectedResponse.urgency] || selectedResponse.urgency}
                  </Badge>
                </div>
                
                {selectedResponse.biggest_challenge && (
                  <div className="bg-secondary/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-2">Maior desafio descrito</p>
                    <p className="text-foreground">{selectedResponse.biggest_challenge}</p>
                  </div>
                )}
              </div>

              {/* Objetivos */}
              {selectedResponse.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Informações Adicionais</h4>
                  <div className="bg-secondary/50 rounded-lg p-4">
                    <p className="text-foreground whitespace-pre-line">{selectedResponse.notes}</p>
                  </div>
                </div>
              )}

              {/* Recomendação */}
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <p className="text-xs text-accent mb-2">Produto(s) Recomendado(s)</p>
                <p className="text-xl font-bold text-accent">{selectedResponse.recommended_product}</p>
              </div>

              {/* Briefing para o Closer */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  📋 Briefing para o Closer
                </h4>
                
                <div className="space-y-4">
                  {/* Resumo do Cliente */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Resumo do Cliente</p>
                    <p className="text-sm text-foreground">
                      <strong>{selectedResponse.contact_name}</strong> da <strong>{selectedResponse.company_name}</strong> 
                      {" "}fatura {revenueLabels[selectedResponse.revenue] || selectedResponse.revenue}/mês 
                      {selectedResponse.team_size !== "sozinho" && ` com ${teamLabels[selectedResponse.team_size] || selectedResponse.team_size}`}
                      {selectedResponse.team_size === "sozinho" && " e vende sozinho(a)"}.
                      {selectedResponse.has_sales_process ? " Já possui processo comercial estruturado." : " Não possui processo comercial estruturado."}
                    </p>
                  </div>

                  {/* Dores Identificadas */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Dores Identificadas</p>
                    <ul className="text-sm text-foreground space-y-1">
                      {selectedResponse.main_pain.split(',').map((pain, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-destructive rounded-full"></span>
                          {painLabels[pain.trim()] || pain.trim()}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Nível de Urgência */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Nível de Urgência</p>
                    <p className="text-sm text-foreground">
                      {selectedResponse.urgency === "imediata" && "🔴 URGENTE - Cliente precisa resolver agora. Abordagem direta e objetiva."}
                      {selectedResponse.urgency === "alta" && "🟠 ALTA - Próximos 30 dias. Cliente está pronto para decidir."}
                      {selectedResponse.urgency === "normal" && "🟡 NORMAL - Prazo de 90 dias. Construir relacionamento antes de oferta."}
                      {selectedResponse.urgency === "exploratoria" && "🟢 EXPLORATÓRIA - Ainda pesquisando. Foco em educar e criar valor."}
                    </p>
                  </div>

                  {/* Perguntas para o Closer */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Perguntas para Fazer</p>
                    <ul className="text-sm text-foreground space-y-2">
                      {selectedResponse.main_pain.includes("sem-processo") && (
                        <li className="flex items-start gap-2">
                          <span className="text-accent">→</span>
                          <span>"Como vocês acompanham o funil de vendas hoje? O que usam para controlar?"</span>
                        </li>
                      )}
                      {selectedResponse.main_pain.includes("inconsistencia") && (
                        <li className="flex items-start gap-2">
                          <span className="text-accent">→</span>
                          <span>"Qual foi o melhor e o pior mês de vendas nos últimos 6 meses? O que aconteceu de diferente?"</span>
                        </li>
                      )}
                      {selectedResponse.main_pain.includes("time-desalinhado") && (
                        <li className="flex items-start gap-2">
                          <span className="text-accent">→</span>
                          <span>"Quantas reuniões de alinhamento você faz com o time por semana? Quem lidera essas reuniões?"</span>
                        </li>
                      )}
                      {selectedResponse.main_pain.includes("poucos-leads") && (
                        <li className="flex items-start gap-2">
                          <span className="text-accent">→</span>
                          <span>"De onde vêm os leads hoje? Qual canal traz mais? Vocês investem em tráfego pago?"</span>
                        </li>
                      )}
                      {selectedResponse.main_pain.includes("conversao-baixa") && (
                        <li className="flex items-start gap-2">
                          <span className="text-accent">→</span>
                          <span>"Qual a taxa de conversão de lead para venda hoje? Em qual etapa vocês perdem mais oportunidades?"</span>
                        </li>
                      )}
                      {selectedResponse.main_pain.includes("escala") && (
                        <li className="flex items-start gap-2">
                          <span className="text-accent">→</span>
                          <span>"O que você acredita que está travando o crescimento? Falta de pessoas, processos ou estratégia?"</span>
                        </li>
                      )}
                      {selectedResponse.main_pain.includes("autoridade") && (
                        <li className="flex items-start gap-2">
                          <span className="text-accent">→</span>
                          <span>"Como os clientes chegam até vocês? Vocês são indicados ou precisam prospectar?"</span>
                        </li>
                      )}
                      {selectedResponse.main_pain.includes("lideranca-fraca") && (
                        <li className="flex items-start gap-2">
                          <span className="text-accent">→</span>
                          <span>"Quem cuida da área comercial hoje? Essa pessoa consegue cobrar resultados do time?"</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <span className="text-accent">→</span>
                        <span>"Se você resolvesse esse problema em 90 dias, quanto isso representaria em faturamento?"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-accent">→</span>
                        <span>"O que já tentou fazer para resolver isso? Por que não funcionou?"</span>
                      </li>
                    </ul>
                  </div>

                  {/* Abordagem Sugerida */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Abordagem Sugerida</p>
                    <p className="text-sm text-foreground bg-secondary/50 rounded p-3">
                      {selectedResponse.urgency === "imediata" || selectedResponse.urgency === "alta" 
                        ? `Foco em resolver a dor AGORA. Mostre que o ${selectedResponse.recommended_product} é a solução mais rápida. Trabalhe escassez e decisão imediata.`
                        : `Construa rapport antes de oferecer. Valide as dores, mostre cases de sucesso similares, e depois apresente o ${selectedResponse.recommended_product} como caminho natural.`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Data e Status */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {format(new Date(selectedResponse.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
                <Badge className={cn(statusColors[selectedResponse.status] || "bg-secondary")}>
                  {selectedResponse.status === "pending" && "Pendente"}
                  {selectedResponse.status === "contacted" && "Contatado"}
                  {selectedResponse.status === "qualified" && "Qualificado"}
                  {selectedResponse.status === "closed" && "Fechado"}
                  {selectedResponse.status === "lost" && "Perdido"}
                </Badge>
              </div>

              {/* Ações */}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => {
                    const phone = selectedResponse.whatsapp.replace(/\D/g, "");
                    const text = `Olá ${selectedResponse.contact_name}! Recebi seu diagnóstico da ${selectedResponse.company_name}. Vamos conversar sobre o ${selectedResponse.recommended_product}?`;
                    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Chamar no WhatsApp
                </Button>
                <Button variant="outline" onClick={() => setSelectedResponse(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
