import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2 } from "lucide-react";
import { ALL_METRIC_KEYS, METRIC_LABELS, type MetricKey } from "./useMetricVisibility";

interface Props {
  visibleMetrics: Set<MetricKey>;
  onToggle: (key: MetricKey) => void;
}

export const MetaAdsMetricSettings = ({ visibleMetrics, onToggle }: Props) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Métricas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Métricas Visíveis</p>
        <div className="space-y-2">
          {ALL_METRIC_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1 -mx-1.5 transition-colors">
              <Checkbox
                checked={visibleMetrics.has(key)}
                onCheckedChange={() => onToggle(key)}
                className="h-3.5 w-3.5"
              />
              <span className="text-xs">{METRIC_LABELS[key]}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
