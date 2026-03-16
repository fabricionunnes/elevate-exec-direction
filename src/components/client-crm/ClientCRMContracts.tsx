import { Card, CardContent } from "@/components/ui/card";
import { FileSignature } from "lucide-react";

export const ClientCRMContracts = () => {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="font-semibold text-lg mb-1">Contratos</h3>
        <p className="text-sm">Gerencie propostas e contratos comerciais do seu negócio.</p>
        <p className="text-xs mt-2 text-muted-foreground/70">Em breve — crie e envie contratos para assinatura digital</p>
      </CardContent>
    </Card>
  );
};
