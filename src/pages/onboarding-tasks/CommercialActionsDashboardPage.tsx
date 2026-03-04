import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CommercialActionsDashboard } from "@/components/commercial-actions/CommercialActionsDashboard";

const CommercialActionsDashboardPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Ações Comerciais</h1>
            <p className="text-muted-foreground text-sm">Painel geral de todas as ações comerciais</p>
          </div>
        </div>
        <CommercialActionsDashboard />
      </div>
    </div>
  );
};

export default CommercialActionsDashboardPage;
