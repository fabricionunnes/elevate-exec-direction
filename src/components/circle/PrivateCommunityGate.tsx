import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Lock, Key, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrivateCommunityGateProps {
  communityId: string;
  communityName: string;
  currentProfileId?: string;
  accessType: "private" | "invite_only" | "subscription";
  onAccessGranted?: () => void;
}

export function PrivateCommunityGate({
  communityId,
  communityName,
  currentProfileId,
  accessType,
  onAccessGranted,
}: PrivateCommunityGateProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check existing request
  const { data: existingRequest, isLoading } = useQuery({
    queryKey: ["circle-community-request", communityId, currentProfileId],
    queryFn: async () => {
      if (!currentProfileId) return null;

      const { data, error } = await supabase
        .from("circle_community_requests")
        .select("*")
        .eq("community_id", communityId)
        .eq("profile_id", currentProfileId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!currentProfileId,
  });

  // Submit access request
  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfileId) throw new Error("Not authenticated");

      const { error } = await supabase.from("circle_community_requests").insert({
        community_id: communityId,
        profile_id: currentProfileId,
        request_message: requestMessage.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Solicitação enviada!" });
      queryClient.invalidateQueries({ queryKey: ["circle-community-request"] });
    },
    onError: () => {
      toast({ title: "Erro ao enviar solicitação", variant: "destructive" });
    },
  });

  // Join with invite code
  const joinWithCodeMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfileId || !inviteCode.trim()) throw new Error("Invalid data");

      // Verify invite code
      const { data: access, error: accessError } = await supabase
        .from("circle_community_access")
        .select("*")
        .eq("community_id", communityId)
        .eq("invite_code", inviteCode.trim().toUpperCase())
        .maybeSingle();

      if (accessError || !access) {
        throw new Error("Código inválido");
      }

      // Add member
      const { error: memberError } = await supabase
        .from("circle_community_members")
        .insert({
          community_id: communityId,
          profile_id: currentProfileId,
          role: "member",
        });

      if (memberError) throw memberError;

      // Update member count
      await supabase
        .from("circle_communities")
        .update({ members_count: supabase.rpc ? 1 : 1 }) // Will be handled by trigger
        .eq("id", communityId);
    },
    onSuccess: () => {
      toast({ title: "Bem-vindo à comunidade! 🎉" });
      queryClient.invalidateQueries({ queryKey: ["circle-community"] });
      onAccessGranted?.();
    },
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Erro ao entrar",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  // Show request status if exists
  if (existingRequest) {
    const statusConfigs = {
      pending: {
        icon: Clock,
        color: "text-yellow-500",
        bg: "bg-yellow-500/10",
        title: "Solicitação Pendente",
        description: "Aguardando aprovação dos moderadores",
      },
      approved: {
        icon: CheckCircle,
        color: "text-green-500",
        bg: "bg-green-500/10",
        title: "Aprovado!",
        description: "Seu acesso foi aprovado",
      },
      rejected: {
        icon: XCircle,
        color: "text-red-500",
        bg: "bg-red-500/10",
        title: "Solicitação Rejeitada",
        description: "Sua solicitação foi rejeitada",
      },
    };
    const statusConfig = statusConfigs[existingRequest.status as keyof typeof statusConfigs] || statusConfigs.pending;

    const Icon = statusConfig.icon;

    return (
      <Card className={statusConfig.bg}>
        <CardContent className="p-6 text-center space-y-4">
          <Icon className={`h-12 w-12 mx-auto ${statusConfig.color}`} />
          <div>
            <h3 className="font-semibold">{statusConfig.title}</h3>
            <p className="text-sm text-muted-foreground">{statusConfig.description}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Comunidade Privada</CardTitle>
        <p className="text-sm text-muted-foreground">
          {communityName} é uma comunidade exclusiva
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Code Section */}
        {(accessType === "invite_only" || accessType === "private") && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tenho um código de convite</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                className="uppercase"
              />
              <Button
                onClick={() => joinWithCodeMutation.mutate()}
                disabled={!inviteCode.trim() || joinWithCodeMutation.isPending}
              >
                Entrar
              </Button>
            </div>
          </div>
        )}

        {/* Request Access Section */}
        {accessType !== "subscription" && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Solicitar acesso</span>
              </div>
              <Textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Por que você quer participar desta comunidade? (opcional)"
                rows={3}
              />
              <Button
                onClick={() => requestMutation.mutate()}
                disabled={requestMutation.isPending}
                className="w-full"
              >
                {requestMutation.isPending ? "Enviando..." : "Solicitar Acesso"}
              </Button>
            </div>
          </>
        )}

        {/* Subscription Info */}
        {accessType === "subscription" && (
          <div className="text-center space-y-3">
            <Badge variant="secondary">Assinatura Necessária</Badge>
            <p className="text-sm text-muted-foreground">
              Esta comunidade requer uma assinatura ativa para participar
            </p>
            <Button disabled className="w-full">
              Ver Planos (em breve)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
