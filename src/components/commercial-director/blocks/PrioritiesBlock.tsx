import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListOrdered } from "lucide-react";

interface Priority {
  rank: number;
  title: string;
  reason: string;
}

interface PrioritiesBlockProps {
  priorities: Priority[];
}

export const PrioritiesBlock = ({ priorities }: PrioritiesBlockProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListOrdered className="h-5 w-5 text-orange-600" />
          Prioridades Estratégicas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {priorities.map((p, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-lg bg-muted/20">
              <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                {p.rank || i + 1}
              </div>
              <div>
                <h4 className="font-semibold text-sm">{p.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{p.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
