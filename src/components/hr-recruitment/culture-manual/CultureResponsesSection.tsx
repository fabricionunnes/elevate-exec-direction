import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ClipboardList, 
  User, 
  Calendar, 
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react";
import { useCultureFormResponses } from "./useCultureManual";
import type { CultureFormResponse } from "./types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CultureResponsesSectionProps {
  projectId: string;
}

interface ResponseFieldProps {
  label: string;
  value: string | null;
}

function ResponseField({ label, value }: ResponseFieldProps) {
  if (!value) return null;
  
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

interface ResponseCardProps {
  response: CultureFormResponse;
}

function ResponseCard({ response }: ResponseCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sections = [
    {
      title: "Identidade e História",
      fields: [
        { label: "História da Empresa", value: response.company_history },
        { label: "História de Fundação", value: response.founding_story },
        { label: "Motivação dos Fundadores", value: response.founders_motivation },
      ]
    },
    {
      title: "Propósito e Missão",
      fields: [
        { label: "Propósito da Empresa", value: response.company_purpose },
        { label: "Missão", value: response.mission_statement },
        { label: "Visão", value: response.vision_statement },
        { label: "Valores Centrais", value: response.core_values },
      ]
    },
    {
      title: "Cultura e Comportamento",
      fields: [
        { label: "Princípios Culturais", value: response.cultural_principles },
        { label: "Comportamentos Esperados", value: response.expected_behaviors },
        { label: "Comportamentos Inaceitáveis", value: response.unacceptable_behaviors },
      ]
    },
    {
      title: "Liderança",
      fields: [
        { label: "Estilo de Liderança", value: response.leadership_style },
        { label: "Expectativas de Liderança", value: response.leadership_expectations },
      ]
    },
    {
      title: "Performance",
      fields: [
        { label: "Cultura de Performance", value: response.performance_culture },
        { label: "Abordagem de Reconhecimento", value: response.recognition_approach },
        { label: "Princípios de Meritocracia", value: response.meritocracy_principles },
      ]
    },
    {
      title: "Comunicação",
      fields: [
        { label: "Estilo de Comunicação", value: response.communication_style },
        { label: "Comunicação Interna", value: response.internal_communication },
      ]
    },
    {
      title: "Clientes",
      fields: [
        { label: "Relacionamento com Clientes", value: response.client_relationship },
        { label: "Visão da Experiência do Cliente", value: response.client_experience_vision },
      ]
    },
    {
      title: "Pessoas",
      fields: [
        { label: "Membro Ideal da Equipe", value: response.ideal_team_member },
        { label: "Quem Não Deve Entrar", value: response.who_should_not_join },
        { label: "Oportunidades de Crescimento", value: response.growth_opportunities },
      ]
    },
    {
      title: "Futuro",
      fields: [
        { label: "Visão de Futuro", value: response.company_future_vision },
        { label: "Aspiração de Legado", value: response.legacy_aspiration },
        { label: "Mensagem Final da Liderança", value: response.final_leadership_message },
      ]
    },
  ];

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {response.respondent_name || "Resposta Anônima"}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {response.respondent_role && (
                      <span>{response.respondent_role}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(response.submitted_at).toLocaleDateString("pt-BR")}
                    </span>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={response.is_complete ? "default" : "secondary"}>
                  {response.is_complete ? "Completo" : "Parcial"}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {sections.map((section) => {
                  const hasContent = section.fields.some(f => f.value);
                  if (!hasContent) return null;

                  return (
                    <div key={section.title} className="space-y-3">
                      <h4 className="font-semibold text-primary border-b pb-2">
                        {section.title}
                      </h4>
                      <div className="space-y-4">
                        {section.fields.map((field) => (
                          <ResponseField 
                            key={field.label} 
                            label={field.label} 
                            value={field.value} 
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {response.additional_notes && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-primary border-b pb-2">
                      Notas Adicionais
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">
                      {response.additional_notes}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function CultureResponsesSection({ projectId }: CultureResponsesSectionProps) {
  const { data: responses, isLoading } = useCultureFormResponses(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!responses || responses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Respostas do Formulário
          </CardTitle>
          <CardDescription>
            As respostas do empresário aparecerão aqui
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Nenhuma resposta recebida ainda.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Envie o link do formulário para o empresário preencher.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Respostas do Formulário
        </h3>
        <Badge variant="outline">
          {responses.length} {responses.length === 1 ? "resposta" : "respostas"}
        </Badge>
      </div>

      <div className="space-y-4">
        {responses.map((response) => (
          <ResponseCard key={response.id} response={response} />
        ))}
      </div>
    </div>
  );
}
