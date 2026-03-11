import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RadarItem {
  area: string;
  status: "green" | "yellow" | "red";
  explanation: string;
  analysis: string;
  causes: string;
  recommendation: string;
}

interface RadarBlockProps {
  radar: RadarItem[];
}

const STATUS_ICON: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

const STATUS_BG: Record<string, string> = {
  green: "border-green-200 bg-green-50/50",
  yellow: "border-yellow-200 bg-yellow-50/50",
  red: "border-red-200 bg-red-50/50",
};

export const RadarBlock = ({ radar }: RadarBlockProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Radar className="h-5 w-5 text-primary" />
          Radar Comercial
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {radar.map((item) => (
            <div
              key={item.area}
              className={`border rounded-lg cursor-pointer transition-all hover:shadow-sm ${STATUS_BG[item.status] || ""}`}
              onClick={() => setExpanded(expanded === item.area ? null : item.area)}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{STATUS_ICON[item.status]}</span>
                  <span className="font-medium text-sm">{item.area}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {expanded === item.area ? "▲" : "▼"}
                </span>
              </div>
              <AnimatePresence>
                {expanded === item.area && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3 text-sm">
                      <div>
                        <p className="font-semibold text-xs text-muted-foreground uppercase">Explicação</p>
                        <p>{item.explanation}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-muted-foreground uppercase">Análise</p>
                        <p>{item.analysis}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-muted-foreground uppercase">Possíveis Causas</p>
                        <p>{item.causes}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-muted-foreground uppercase">Recomendação</p>
                        <p className="text-primary font-medium">{item.recommendation}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
