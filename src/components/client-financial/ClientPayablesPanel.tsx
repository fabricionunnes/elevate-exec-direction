import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function ClientPayablesPanel({ projectId, canEdit }: Props) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Construction className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Contas a Pagar</h3>
        <p className="text-sm text-muted-foreground">Em desenvolvimento</p>
      </CardContent>
    </Card>
  );
}
