import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code2 } from "lucide-react";
import { FinancialApiDocs } from "@/components/financial-api/FinancialApiDocs";
import { SystemApiDocs } from "@/components/financial-api/SystemApiDocs";

export default function ApiDocsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/onboarding-tasks")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Nexus
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Documentação da API
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        <FinancialApiDocs />
        <SystemApiDocs />
      </main>
    </div>
  );
}
