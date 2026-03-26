import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { List, Trash2, Eye, Loader2 } from "lucide-react";
import type { B2BSavedList, B2BLead } from "@/types/b2bProspection";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SavedListsProps {
  lists: B2BSavedList[];
  loading: boolean;
  onViewList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
}

export function SavedLists({ lists, loading, onViewList, onDeleteList }: SavedListsProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lists.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <List className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma lista salva</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {lists.map((list) => (
          <Card key={list.id} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{list.name}</p>
                {list.description && (
                  <p className="text-xs text-muted-foreground truncate">{list.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{list.lead_count} leads</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(list.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onViewList(list.id)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => setDeleteId(list.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os leads desta lista serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDeleteList(deleteId);
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
