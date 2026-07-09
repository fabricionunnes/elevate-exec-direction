import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import CopilotPanel from "@/components/onboarding-tasks/CopilotPanel";

export default function CopilotPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-bold leading-tight">Copiloto de Resultados</h1>
              <p className="text-xs text-muted-foreground">Ações sugeridas para fazer seu cliente bater meta</p>
            </div>
          </div>
        </div>
        <CopilotPanel />
      </div>
    </div>
  );
}
