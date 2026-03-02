import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PaymentNotificationConfig } from "@/components/financial/PaymentNotificationConfig";

export default function PaymentNotificationsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-semibold">Configurar Notificações de Pagamento</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <PaymentNotificationConfig />
      </main>
    </div>
  );
}
