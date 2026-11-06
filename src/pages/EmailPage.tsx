// E-mail de cada usuário dentro do Nexus, em rota própria (/email), fora do CRM (06/11/2026):
// consultores sem acesso ao CRM também usam. A tela em si é a CRMEmailPage.
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import CRMEmailPage from "@/pages/crm/CRMEmailPage";

const EmailPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="mobile-safe-header container mx-auto px-4 pb-3 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding-tasks")} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nexus
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="flex min-w-0 items-center gap-2 py-0.5 text-lg font-semibold leading-[1.35]">
              <Mail className="h-5 w-5 shrink-0 text-primary" />
              E-mail
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-4">
        <CRMEmailPage />
      </main>
    </div>
  );
};

export default EmailPage;
