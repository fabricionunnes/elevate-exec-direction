import { LeadSummaryData } from "./useLeadSummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  RefreshCw,
  CalendarClock,
  Target,
  MessageCircle,
  Phone,
  Mail,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Shield,
  Copy,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface LeadSummaryFollowUpProps {
  data: LeadSummaryData | null;
  loading: boolean;
  onRegenerate: () => void;
}

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle className="h-4 w-4 text-green-500" />,
  ligação: <Phone className="h-4 w-4 text-blue-500" />,
  email: <Mail className="h-4 w-4 text-orange-500" />,
  presencial: <Users className="h-4 w-4 text-purple-500" />,
};

const urgencyConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  critical: { color: "bg-red-500/10 text-red-600 border-red-500/30", label: "Crítica", icon: <Flame className="h-4 w-4" /> },
  high: { color: "bg-orange-500/10 text-orange-600 border-orange-500/30", label: "Alta", icon: <AlertTriangle className="h-4 w-4" /> },
  medium: { color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30", label: "Média", icon: <Clock className="h-4 w-4" /> },
  low: { color: "bg-green-500/10 text-green-600 border-green-500/30", label: "Baixa", icon: <CheckCircle2 className="h-4 w-4" /> },
};

const priorityColors: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-yellow-500",
  low: "border-l-green-500",
};

const toneLabels: Record<string, string> = {
  empático: "🤝 Empático",
  direto: "🎯 Direto",
  urgente: "🔥 Urgente",
};

function copyScript(script: string) {
  navigator.clipboard.writeText(script);
  toast.success("Script copiado!");
}

export const LeadSummaryFollowUp = ({ data, loading, onRegenerate }: LeadSummaryFollowUpProps) => {
  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const ai = data.ai;
  const generatedAt = data._generated_at
    ? format(new Date(data._generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  const closingDate = ai?.closing_date;
  const urgency = urgencyConfig[ai?.urgency_level] || urgencyConfig.medium;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Follow Up — {data.lead.name}
          </h3>
          {generatedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Gerado em: {generatedAt} • Etapa: {data.lead.current_stage}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerar
        </Button>
      </div>

      {/* Closing Date Detection */}
      <Card className={closingDate?.detected ? "border-primary/40 bg-primary/5" : "border-muted"}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Data de Fechamento Identificada
          </CardTitle>
        </CardHeader>
        <CardContent>
          {closingDate?.detected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="default" className="text-sm px-3 py-1">
                  📅 {closingDate.date ? format(new Date(closingDate.date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "Data não especificada"}
                </Badge>
                {closingDate.days_remaining !== null && closingDate.days_remaining !== undefined && (
                  <Badge variant={closingDate.days_remaining <= 0 ? "destructive" : closingDate.days_remaining <= 3 ? "secondary" : "outline"}>
                    {closingDate.days_remaining <= 0
                      ? `⚠️ ${Math.abs(closingDate.days_remaining)} dias atrás`
                      : `⏳ ${closingDate.days_remaining} dias restantes`}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Confiança: {closingDate.confidence === "high" ? "🟢 Alta" : closingDate.confidence === "medium" ? "🟡 Média" : "🔴 Baixa"}
                </Badge>
              </div>
              {closingDate.context && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3 mt-2">
                  "{closingDate.context}"
                </p>
              )}
              {closingDate.source && (
                <p className="text-xs text-muted-foreground">Fonte: {closingDate.source}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma data de fechamento mencionada pelo cliente. Continue o follow-up para criar urgência.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Status + Urgency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status do Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{ai?.lead_status_summary || "Sem dados suficientes."}</p>
          </CardContent>
        </Card>
        <Card className={`border ${urgency.color}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {urgency.icon}
              Urgência: {urgency.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{ai?.urgency_reason || ""}</p>
          </CardContent>
        </Card>
      </div>

      {/* Follow Up Timeline */}
      {ai?.followup_timeline && ai.followup_timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Timeline de Follow Up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <Accordion type="multiple" className="space-y-2">
              {ai.followup_timeline.map((item: any, idx: number) => (
                <AccordionItem
                  key={idx}
                  value={`followup-${idx}`}
                  className={`border-l-4 ${priorityColors[item.priority] || "border-l-muted"} rounded-lg border bg-card px-0`}
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-left w-full">
                      {item.is_past_due ? (
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-primary">{item.day_label}</span>
                          {channelIcons[item.channel] || null}
                          <span className="text-xs text-muted-foreground capitalize">{item.channel}</span>
                          {item.is_past_due && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>}
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate">{item.action}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      <strong>Objetivo:</strong> {item.objective}
                    </p>
                    {item.script && (
                      <div className="relative">
                        <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap border">
                          {item.script}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={() => copyScript(item.script)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    {item.tips && item.tips.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Dicas:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {item.tips.map((tip: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-primary">•</span> {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Post Closing Date Plan */}
      {ai?.post_closing_date_plan && ai.post_closing_date_plan.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Plano Pós-Data de Fechamento
            </CardTitle>
            <p className="text-xs text-muted-foreground">Ações caso o cliente não feche na data prevista</p>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {ai.post_closing_date_plan.map((item: any, idx: number) => (
                <AccordionItem key={idx} value={`post-${idx}`} className="rounded-lg border bg-card px-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-left w-full">
                      {channelIcons[item.channel] || null}
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-orange-600">{item.day_label}</span>
                        <p className="text-sm font-medium">{item.action}</p>
                      </div>
                      {item.tone && (
                        <span className="text-xs text-muted-foreground">{toneLabels[item.tone] || item.tone}</span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {item.script && (
                      <div className="relative">
                        <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap border">
                          {item.script}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={() => copyScript(item.script)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Objection Scripts */}
      {ai?.objection_scripts && ai.objection_scripts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Scripts para Objeções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {ai.objection_scripts.map((item: any, idx: number) => (
                <AccordionItem key={idx} value={`obj-${idx}`} className="rounded-lg border bg-card px-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="text-left">
                      <p className="text-sm font-medium">❌ "{item.objection}"</p>
                      <p className="text-xs text-muted-foreground">Técnica: {item.technique}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="relative">
                      <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap border">
                        {item.response_script}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={() => copyScript(item.response_script)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Golden Rules */}
      {ai?.golden_rules && ai.golden_rules.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              ⭐ Regras de Ouro para Este Follow Up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {ai.golden_rules.map((rule: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-primary font-bold">{idx + 1}.</span>
                  {rule}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Next Immediate Action */}
      {ai?.next_immediate_action && (
        <Card className="border-primary bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              🎯 Próxima Ação Imediata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="default">{ai.next_immediate_action.action}</Badge>
              {channelIcons[ai.next_immediate_action.channel] || null}
              <span className="text-xs text-muted-foreground">
                Quando: {ai.next_immediate_action.when}
              </span>
            </div>
            {ai.next_immediate_action.script && (
              <div className="relative">
                <div className="bg-background rounded-lg p-3 text-sm whitespace-pre-wrap border">
                  {ai.next_immediate_action.script}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => copyScript(ai.next_immediate_action.script)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
