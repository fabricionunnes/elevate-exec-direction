import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, UserMinus, Trash2, Crown, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface CommunitySettingsDialogProps {
  communityId: string;
  communityName: string;
  ownerProfileId: string;
  currentProfileId: string;
  isAdmin: boolean;
}

export function CommunitySettingsDialog({
  communityId,
  communityName,
  ownerProfileId,
  currentProfileId,
  isAdmin,
}: CommunitySettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isOwner = ownerProfileId === currentProfileId;
  const canManage = isOwner || isAdmin;

  // Fetch community members for transfer
  const { data: members } = useQuery({
    queryKey: ["circle-community-members-for-transfer", communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_community_members")
        .select(`
          id,
          profile_id,
          role,
          profile:circle_profiles!circle_community_members_profile_id_fkey(
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("community_id", communityId)
        .neq("profile_id", ownerProfileId);

      if (error) throw error;
      return data;
    },
    enabled: open && isOwner,
  });

  // Transfer ownership mutation
  const transferMutation = useMutation({
    mutationFn: async (newOwnerProfileId: string) => {
      // Update community owner
      const { error: updateError } = await supabase
        .from("circle_communities")
        .update({ owner_profile_id: newOwnerProfileId })
        .eq("id", communityId);

      if (updateError) throw updateError;

      // Update member roles
      await supabase
        .from("circle_community_members")
        .update({ role: "member" })
        .eq("community_id", communityId)
        .eq("profile_id", ownerProfileId);

      await supabase
        .from("circle_community_members")
        .update({ role: "owner" })
        .eq("community_id", communityId)
        .eq("profile_id", newOwnerProfileId);
    },
    onSuccess: () => {
      toast({ title: "Propriedade transferida com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["circle-community"] });
      queryClient.invalidateQueries({ queryKey: ["circle-community-members"] });
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao transferir propriedade", variant: "destructive" });
    },
  });

  // Delete community mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Soft delete - just mark as inactive
      const { error } = await supabase
        .from("circle_communities")
        .update({ is_active: false })
        .eq("id", communityId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Comunidade excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["circle-communities"] });
      navigate("/circle/communities");
    },
    onError: () => {
      toast({ title: "Erro ao excluir comunidade", variant: "destructive" });
    },
  });

  const filteredMembers = members?.filter((m) =>
    m.profile?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!canManage) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações da Comunidade</DialogTitle>
          <DialogDescription>
            Gerencie as configurações de "{communityName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Transfer Ownership - Only for owner */}
          {isOwner && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                Transferir Propriedade
              </Label>
              <p className="text-sm text-muted-foreground">
                Escolha um membro para ser o novo dono desta comunidade.
              </p>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar membro..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-48 border rounded-md">
                {filteredMembers?.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {members?.length === 0
                      ? "Nenhum membro disponível"
                      : "Nenhum membro encontrado"}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredMembers?.map((member) => (
                      <AlertDialog key={member.id}>
                        <AlertDialogTrigger asChild>
                          <button className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profile?.avatar_url || undefined} />
                              <AvatarFallback>
                                {member.profile?.display_name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {member.profile?.display_name}
                              </p>
                            </div>
                            {member.role === "admin" && (
                              <Badge variant="secondary" className="text-xs">
                                Admin
                              </Badge>
                            )}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Transferir Propriedade</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja transferir a propriedade da comunidade para{" "}
                              <strong>{member.profile?.display_name}</strong>?
                              <br />
                              <br />
                              Você perderá os privilégios de dono e não poderá desfazer esta ação.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => transferMutation.mutate(member.profile_id)}
                              disabled={transferMutation.isPending}
                            >
                              {transferMutation.isPending ? "Transferindo..." : "Confirmar"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Delete Community - Owner or Admin */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Zona de Perigo
            </Label>
            <p className="text-sm text-muted-foreground">
              {isAdmin && !isOwner
                ? "Como administrador, você pode excluir qualquer comunidade."
                : "Excluir esta comunidade permanentemente."}
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Comunidade
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Comunidade</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir a comunidade "{communityName}"?
                    <br />
                    <br />
                    Todos os posts, membros e dados serão removidos. Esta ação não pode ser
                    desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? "Excluindo..." : "Excluir Permanentemente"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
