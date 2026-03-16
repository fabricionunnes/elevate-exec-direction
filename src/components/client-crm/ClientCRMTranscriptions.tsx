import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const ClientCRMTranscriptions = () => {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="font-semibold text-lg mb-1">Transcrições</h3>
        <p className="text-sm">Transcrições de reuniões e chamadas comerciais do seu negócio.</p>
        <p className="text-xs mt-2 text-muted-foreground/70">Em breve — grave suas reuniões e tenha transcrições automáticas</p>
      </CardContent>
    </Card>
  );
};
