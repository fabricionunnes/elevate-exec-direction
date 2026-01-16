import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  UserPlus,
  Plus,
  Trash2,
  Gift,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Referral {
  id: string;
  referred_name: string;
  referred_phone: string;
  status: "pending" | "negotiating" | "closed" | "not_closed";
  reward_value: number;
  created_at: string;
  closed_at: string | null;
}

interface NewReferral {
  name: string;
  phone: string;
}

interface ClientReferralsPanelProps {
  companyId: string;
  projectId: string;
  userName?: string;
}

const statusConfig = {
  pending: { label: "Pendente", icon: Clock, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  negotiating: { label: "Em Negociação", icon: TrendingUp, color: "text-blue-600 bg-blue-50 border-blue-200" },
  closed: { label: "Fechado ✓", icon: CheckCircle, color: "text-green-600 bg-green-50 border-green-200" },
  not_closed: { label: "Não Fechado", icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
};

export function ClientReferralsPanel({ companyId, projectId, userName }: ClientReferralsPanelProps) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newReferrals, setNewReferrals] = useState<NewReferral[]>([{ name: "", phone: "" }]);

  const fetchReferrals = async () => {
    try {
      const { data, error } = await supabase
        .from("client_referrals")
        .select("*")
        .eq("referrer_company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReferrals((data as unknown as Referral[]) || []);
    } catch (error) {
      console.error("Error fetching referrals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchReferrals();

      // Subscribe to realtime updates for this company's referrals
      const channel = supabase
        .channel(`client-referrals-${companyId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "client_referrals",
            filter: `referrer_company_id=eq.${companyId}`,
          },
          (payload) => {
            fetchReferrals();
            
            // Notify client when a referral is closed
            if (payload.eventType === "UPDATE" && (payload.new as any).status === "closed") {
              toast.success(
                `🎉 Sua indicação "${(payload.new as any).referred_name}" foi fechada! Parabéns!`,
                { duration: 5000 }
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [companyId]);

  const handleAddReferral = () => {
    setNewReferrals([...newReferrals, { name: "", phone: "" }]);
  };

  const handleRemoveReferral = (index: number) => {
    setNewReferrals(newReferrals.filter((_, i) => i !== index));
  };

  const handleReferralChange = (index: number, field: "name" | "phone", value: string) => {
    const updated = [...newReferrals];
    updated[index][field] = value;
    setNewReferrals(updated);
  };

  const handleSubmitReferrals = async () => {
    const validReferrals = newReferrals.filter((r) => r.name.trim() && r.phone.trim());

    if (validReferrals.length === 0) {
      toast.error("Preencha pelo menos uma indicação com nome e telefone");
      return;
    }

    setSubmitting(true);
    try {
      const referralInserts = validReferrals.map((r) => ({
        referrer_company_id: companyId,
        referrer_project_id: projectId,
        referrer_name: userName || null,
        referred_name: r.name.trim(),
        referred_phone: r.phone.trim(),
        source: "portal" as const,
      }));

      const { error } = await supabase.from("client_referrals").insert(referralInserts);

      if (error) throw error;

      toast.success("Indicação(ões) enviada(s) com sucesso!");
      setNewReferrals([{ name: "", phone: "" }]);
      fetchReferrals();
    } catch (error) {
      console.error("Error submitting referrals:", error);
      toast.error("Erro ao enviar indicações");
    } finally {
      setSubmitting(false);
    }
  };

  const stats = {
    total: referrals.length,
    closed: referrals.filter((r) => r.status === "closed").length,
    totalRewards: referrals
      .filter((r) => r.status === "closed")
      .reduce((sum, r) => sum + (r.reward_value || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {referrals.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <UserPlus className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Indicações</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{stats.closed}</p>
              <p className="text-sm text-muted-foreground">Fechadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
              <p className="text-2xl font-bold">
                R$ {stats.totalRewards.toLocaleString("pt-BR")}
              </p>
              <p className="text-sm text-muted-foreground">Ganhos</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* New Referral Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Indique e Ganhe!
          </CardTitle>
          <CardDescription>
            Indique amigos ou empresas e ganhe recompensas quando fecharem conosco.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {newReferrals.map((referral, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Nome do indicado"
                  value={referral.name}
                  onChange={(e) => handleReferralChange(index, "name", e.target.value)}
                />
                <Input
                  placeholder="Telefone/WhatsApp"
                  value={referral.phone}
                  onChange={(e) => handleReferralChange(index, "phone", e.target.value)}
                />
              </div>
              {newReferrals.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveReferral(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleAddReferral} className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar outra
            </Button>
            <Button onClick={handleSubmitReferrals} disabled={submitting} className="flex-1">
              {submitting ? "Enviando..." : "Enviar Indicação"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referrals History */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Minhas Indicações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {referrals.map((referral) => {
                const StatusIcon = statusConfig[referral.status].icon;
                return (
                  <div
                    key={referral.id}
                    className={`p-4 rounded-lg border ${statusConfig[referral.status].color}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{referral.referred_name}</p>
                        <p className="text-sm flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" />
                          {referral.referred_phone}
                        </p>
                        <p className="text-xs mt-2 opacity-70">
                          Indicado em {format(new Date(referral.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={statusConfig[referral.status].color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[referral.status].label}
                        </Badge>
                        {referral.status === "closed" && referral.reward_value > 0 && (
                          <p className="text-sm font-medium text-green-600 mt-2">
                            +R$ {referral.reward_value.toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
