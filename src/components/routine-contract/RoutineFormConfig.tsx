import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Link, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Props {
  projectId: string;
  isAdmin: boolean;
}

export const RoutineFormConfig = ({ projectId, isAdmin }: Props) => {
  const queryClient = useQueryClient();

  const { data: links, isLoading } = useQuery({
    queryKey: ["routine-form-links", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_form_links")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("routine_form_links")
        .insert({ project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-form-links", projectId] });
      toast.success("Link criado com sucesso!");
    },
    onError: () => toast.error("Erro ao criar link"),
  });

  const toggleLink = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("routine_form_links")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-form-links", projectId] });
      toast.success("Link atualizado!");
    },
  });

  const getPublicUrl = (token: string) => {
    const base = window.location.origin;
    return `${base}/#/contrato-rotina/${token}`;
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getPublicUrl(token));
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Links do Formulário</h3>
        {isAdmin && (
          <Button onClick={() => createLink.mutate()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Criar Link
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : !links?.length ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Link className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhum link criado. Crie um link para enviar aos colaboradores.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <Card key={link.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded break-all max-w-[300px] truncate">
                        {getPublicUrl(link.access_token)}
                      </code>
                      <Badge variant={link.is_active ? "default" : "secondary"}>
                        {link.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Criado em {format(new Date(link.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyLink(link.access_token)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(getPublicUrl(link.access_token), "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant={link.is_active ? "destructive" : "default"}
                        size="sm"
                        onClick={() => toggleLink.mutate({ id: link.id, is_active: !link.is_active })}
                      >
                        {link.is_active ? "Desativar" : "Ativar"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
