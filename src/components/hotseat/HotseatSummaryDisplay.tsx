import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb,
  Target,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface CompanyMentioned {
  name: string;
  challenges?: string[];
  recommendations?: string[];
}

interface Props {
  summary: string;
  companiesMentioned?: CompanyMentioned[] | unknown;
}

export function HotseatSummaryDisplay({ summary, companiesMentioned }: Props) {
  const companies = Array.isArray(companiesMentioned) ? companiesMentioned : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h5 className="font-semibold text-foreground">Resumo Executivo</h5>
          <p className="text-xs text-muted-foreground">Gerado por IA</p>
        </div>
      </div>

      {/* Companies mentioned as chips */}
      {companies.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="font-medium">Empresas mencionadas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {companies.map((company, idx) => (
              <Badge 
                key={idx} 
                variant="secondary" 
                className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              >
                <Building2 className="h-3 w-3 mr-1" />
                {typeof company === 'string' ? company : company.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main Summary Content */}
      <ScrollArea className="max-h-[70vh]">
        <div className="space-y-4">
          {/* Parse and display structured content */}
          <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
            <div className="prose prose-sm max-w-none 
              prose-headings:text-foreground prose-headings:font-semibold prose-headings:mb-3 prose-headings:mt-4 first:prose-headings:mt-0
              prose-h1:text-lg prose-h1:flex prose-h1:items-center prose-h1:gap-2 prose-h1:border-b prose-h1:pb-2
              prose-h2:text-base prose-h2:text-primary
              prose-h3:text-sm prose-h3:text-muted-foreground
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:space-y-1.5 prose-ul:my-2
              prose-li:text-muted-foreground prose-li:leading-relaxed
              prose-li:marker:text-primary
            ">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-lg font-semibold flex items-center gap-2 border-b pb-2 mb-3">
                      <Target className="h-5 w-5 text-primary" />
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => {
                    const text = String(children).toLowerCase();
                    let icon = <MessageSquare className="h-4 w-4" />;
                    let colorClass = "text-primary";
                    
                    if (text.includes("desafio") || text.includes("problema") || text.includes("risco")) {
                      icon = <AlertTriangle className="h-4 w-4" />;
                      colorClass = "text-amber-600";
                    } else if (text.includes("recomenda") || text.includes("sugest") || text.includes("ação")) {
                      icon = <Lightbulb className="h-4 w-4" />;
                      colorClass = "text-emerald-600";
                    } else if (text.includes("oportunidade") || text.includes("próximo")) {
                      icon = <TrendingUp className="h-4 w-4" />;
                      colorClass = "text-blue-600";
                    } else if (text.includes("conclus") || text.includes("resumo")) {
                      icon = <CheckCircle2 className="h-4 w-4" />;
                      colorClass = "text-purple-600";
                    }
                    
                    return (
                      <h2 className={`text-base font-semibold flex items-center gap-2 mt-5 mb-2 ${colorClass}`}>
                        {icon}
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children }) => (
                    <h3 className="text-sm font-medium text-muted-foreground mt-3 mb-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {children}
                    </h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 my-3 ml-0 list-none">{children}</ul>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed pl-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/60 mt-2 flex-shrink-0" />
                      <span>{children}</span>
                    </li>
                  ),
                  p: ({ children }) => (
                    <p className="text-sm text-muted-foreground leading-relaxed my-2">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Company Details Cards */}
      {companies.length > 0 && companies.some(c => typeof c !== 'string' && (c.challenges?.length || c.recommendations?.length)) && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Building2 className="h-4 w-4 text-primary" />
            Detalhes por Empresa
          </div>
          
          <div className="grid gap-3">
            {companies.filter(c => typeof c !== 'string' && (c.challenges?.length || c.recommendations?.length)).map((company, idx) => {
              if (typeof company === 'string') return null;
              
              return (
                <div 
                  key={idx} 
                  className="rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                      {company.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <h4 className="font-semibold text-foreground">{company.name}</h4>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {company.challenges && company.challenges.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Desafios Identificados
                        </div>
                        <ul className="space-y-1.5">
                          {company.challenges.map((challenge, cidx) => (
                            <li key={cidx} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <div className="h-1 w-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                              {challenge}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {company.recommendations && company.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <Lightbulb className="h-3.5 w-3.5" />
                          Recomendações
                        </div>
                        <ul className="space-y-1.5">
                          {company.recommendations.map((rec, ridx) => (
                            <li key={ridx} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <div className="h-1 w-1 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
