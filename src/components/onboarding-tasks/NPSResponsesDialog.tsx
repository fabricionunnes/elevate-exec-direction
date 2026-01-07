import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, MessageSquare, Star, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NPSResponse {
  id: string;
  project_id: string;
  score: number;
  feedback: string | null;
  what_can_improve: string | null;
  would_recommend_why: string | null;
  respondent_name: string | null;
  respondent_email: string | null;
  created_at: string;
}

interface NPSResponsesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responses: NPSResponse[];
  type: "promoters" | "detractors" | "neutrals";
  getCompanyName: (projectId: string) => string;
  getProjectName: (projectId: string) => string;
}

const NPSResponsesDialog = ({
  open,
  onOpenChange,
  responses,
  type,
  getCompanyName,
  getProjectName,
}: NPSResponsesDialogProps) => {
  const getTitle = () => {
    switch (type) {
      case "promoters":
        return "Promotores (NPS 9-10)";
      case "detractors":
        return "Detratores (NPS 0-6)";
      case "neutrals":
        return "Neutros (NPS 7-8)";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return "bg-green-500";
    if (score >= 7) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 9) return "Promotor";
    if (score >= 7) return "Neutro";
    return "Detrator";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className={`h-5 w-5 ${type === "promoters" ? "text-green-500" : type === "detractors" ? "text-red-500" : "text-yellow-500"}`} />
            {getTitle()} ({responses.length})
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[65vh] pr-4">
          {responses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma resposta encontrada
            </p>
          ) : (
            <div className="space-y-3">
              {responses.map((response) => (
                <Card key={response.id} className="border-l-4" style={{ borderLeftColor: getScoreColor(response.score).replace("bg-", "#").replace("green-500", "22c55e").replace("yellow-500", "eab308").replace("red-500", "ef4444") }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {getCompanyName(response.project_id)}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {getProjectName(response.project_id)}
                          </Badge>
                        </div>
                        {response.respondent_name && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{response.respondent_name}</span>
                            {response.respondent_email && (
                              <span className="text-muted-foreground/70">({response.respondent_email})</span>
                            )}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(response.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-center shrink-0">
                        <div className={`${getScoreColor(response.score)} text-white font-bold text-lg rounded-full w-10 h-10 flex items-center justify-center`}>
                          {response.score}
                        </div>
                        <span className="text-[9px] text-muted-foreground">
                          {getScoreLabel(response.score)}
                        </span>
                      </div>
                    </div>
                    
                    {(response.feedback || response.would_recommend_why || response.what_can_improve) && (
                      <div className="space-y-2 mt-3 pt-3 border-t">
                        {response.would_recommend_why && (
                          <div className="text-sm">
                            <p className="text-[10px] font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              Por que recomendaria?
                            </p>
                            <p className="text-sm text-foreground/90">{response.would_recommend_why}</p>
                          </div>
                        )}
                        {response.feedback && (
                          <div className="text-sm">
                            <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Feedback</p>
                            <p className="text-sm text-foreground/90">{response.feedback}</p>
                          </div>
                        )}
                        {response.what_can_improve && (
                          <div className="text-sm">
                            <p className="text-[10px] font-medium text-muted-foreground mb-0.5">O que podemos melhorar?</p>
                            <p className="text-sm text-foreground/90">{response.what_can_improve}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default NPSResponsesDialog;
