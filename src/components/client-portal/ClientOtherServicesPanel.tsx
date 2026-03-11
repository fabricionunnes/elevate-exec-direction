import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Check, Clock, X, Sparkles } from "lucide-react";
import { useClientPermissions } from "@/hooks/useClientPermissions";

interface ServiceCatalogItem {
  id: string;
  menu_key: string;
  name: string;
  description: string | null;
  price: number;
  billing_type: "monthly" | "one_time";
  sort_order: number;
}

interface ServiceRequest {
  id: string;
  menu_key: string;
  status: string;
  created_at: string;
}

interface ClientOtherServicesPanelProps {
  projectId: string;
  currentUserId: string;
}

export const ClientOtherServicesPanel = ({
  projectId,
  currentUserId,
}: ClientOtherServicesPanelProps) => {
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const { hasPermission } = useClientPermissions(projectId);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catalogRes, requestsRes] = await Promise.all([
        supabase
          .from("service_catalog")
          .select("*")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("service_requests")
          .select("id, menu_key, status, created_at")
          .eq("project_id", projectId),
      ]);

      if (catalogRes.data) setCatalog(catalogRes.data as ServiceCatalogItem[]);
      if (requestsRes.data) setRequests(requestsRes.data);
    } catch (error) {
      console.error("Error fetching service catalog:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (service: ServiceCatalogItem) => {
    setRequesting(service.id);
    try {
      const { error } = await supabase.from("service_requests").insert({
        project_id: projectId,
        service_catalog_id: service.id,
        menu_key: service.menu_key,
        requested_by: currentUserId,
      });

      if (error) throw error;

      toast.success(`Solicitação enviada para "${service.name}"! Nossa equipe entrará em contato.`);
      fetchData();
    } catch (error: any) {
      console.error("Error requesting service:", error);
      toast.error(error.message || "Erro ao solicitar serviço");
    } finally {
      setRequesting(null);
    }
  };

  // Filter: only show services the client does NOT have access to
  const availableServices = catalog.filter((service) => {
    // For gestao_clientes, check all related keys
    if (service.menu_key === "gestao_clientes") {
      const gestaoKeys = ["gestao_clientes", "gestao_vendas", "gestao_financeiro", "gestao_estoque", "gestao_agendamentos"];
      return !gestaoKeys.some((key) => hasPermission(key));
    }
    return !hasPermission(service.menu_key);
  });

  const getRequestStatus = (menuKey: string) => {
    const req = requests.find((r) => r.menu_key === menuKey && r.status === "pending");
    if (req) return "pending";
    const approved = requests.find((r) => r.menu_key === menuKey && r.status === "approved");
    if (approved) return "approved";
    return null;
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (availableServices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Sparkles className="h-12 w-12 text-primary mb-4" />
        <h3 className="text-lg font-semibold mb-2">Você já tem acesso a todos os serviços!</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Todos os módulos disponíveis já estão liberados para sua conta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Outros Serviços</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Conheça e solicite a liberação de módulos adicionais para potencializar seu negócio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableServices.map((service) => {
          const reqStatus = getRequestStatus(service.menu_key);

          return (
            <Card
              key={service.id}
              className="relative overflow-hidden border transition-all hover:shadow-md"
            >
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-base leading-tight">{service.name}</h3>
                    <Badge
                      variant="secondary"
                      className="text-xs ml-2 flex-shrink-0"
                    >
                      {service.billing_type === "monthly" ? "Mensal" : "Único"}
                    </Badge>
                  </div>

                  {service.description && (
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {service.description}
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-bold text-primary">
                        {formatPrice(service.price)}
                      </span>
                      {service.billing_type === "monthly" && (
                        <span className="text-xs text-muted-foreground">/mês</span>
                      )}
                    </div>

                    {reqStatus === "pending" ? (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Solicitado
                      </Badge>
                    ) : reqStatus === "approved" ? (
                      <Badge className="gap-1 bg-green-600">
                        <Check className="h-3 w-3" />
                        Aprovado
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleRequest(service)}
                        disabled={requesting === service.id}
                      >
                        {requesting === service.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            Solicitar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
