import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface AdSetData {
  name: string;
  targeting: Record<string, any>;
  placements: string[];
  frequency_cap_impressions: number;
  frequency_cap_hours: number;
}

interface Props {
  data: AdSetData;
  onChange: (data: AdSetData) => void;
}

const placements = [
  { value: "feed", label: "Feed Principal", description: "Aparecer no feed de posts" },
  { value: "stories", label: "Stories", description: "Aparecer entre os stories" },
  { value: "communities", label: "Comunidades", description: "Aparecer nas comunidades" },
  { value: "marketplace", label: "Marketplace", description: "Aparecer no marketplace" },
];

const interestTags = [
  "Vendas", "Marketing", "Gestão", "RH", "Finanças", "Tecnologia", 
  "Empreendedorismo", "Liderança", "Produtividade", "Networking"
];

const reputationAreas = [
  { value: "vendas", label: "Vendas" },
  { value: "gestao", label: "Gestão" },
  { value: "rh", label: "RH" },
  { value: "marketing", label: "Marketing" },
  { value: "financeiro", label: "Financeiro" },
];

export function CircleAdsAdSetForm({ data, onChange }: Props) {
  const updateTargeting = (key: string, value: any) => {
    onChange({
      ...data,
      targeting: {
        ...data.targeting,
        [key]: value,
      },
    });
  };

  const togglePlacement = (placement: string) => {
    const newPlacements = data.placements.includes(placement)
      ? data.placements.filter((p) => p !== placement)
      : [...data.placements, placement];
    onChange({ ...data, placements: newPlacements });
  };

  const toggleInterest = (interest: string) => {
    const currentInterests = data.targeting.interests || [];
    const newInterests = currentInterests.includes(interest)
      ? currentInterests.filter((i: string) => i !== interest)
      : [...currentInterests, interest];
    updateTargeting("interests", newInterests);
  };

  const toggleReputationArea = (area: string) => {
    const current = data.targeting.reputation_areas || [];
    const updated = current.includes(area)
      ? current.filter((a: string) => a !== area)
      : [...current, area];
    updateTargeting("reputation_areas", updated);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="adset-name">Nome do Conjunto</Label>
        <Input
          id="adset-name"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="Ex: Público Geral"
        />
      </div>

      {/* Placements */}
      <div className="space-y-3">
        <Label>Posicionamento</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {placements.map((p) => (
            <div
              key={p.value}
              onClick={() => togglePlacement(p.value)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                data.placements.includes(p.value)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Checkbox checked={data.placements.includes(p.value)} />
                <div>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Targeting Options */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="interests">
          <AccordionTrigger className="text-sm">
            Interesses
            {(data.targeting.interests?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {data.targeting.interests.length}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {interestTags.map((interest) => (
                <Badge
                  key={interest}
                  variant={data.targeting.interests?.includes(interest) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </Badge>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="reputation">
          <AccordionTrigger className="text-sm">
            Área de Reputação
            {(data.targeting.reputation_areas?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {data.targeting.reputation_areas.length}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {reputationAreas.map((area) => (
                <Badge
                  key={area.value}
                  variant={data.targeting.reputation_areas?.includes(area.value) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleReputationArea(area.value)}
                >
                  {area.label}
                </Badge>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="trust_score">
          <AccordionTrigger className="text-sm">
            Trust Score Mínimo do Público
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Apenas usuários com Trust Score acima de:
                </span>
                <span className="font-medium">{data.targeting.min_trust_score || 0}</span>
              </div>
              <Slider
                value={[data.targeting.min_trust_score || 0]}
                onValueChange={([v]) => updateTargeting("min_trust_score", v)}
                max={100}
                step={5}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Frequency Capping */}
      <div className="space-y-3">
        <Label>Limite de Frequência</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Impressões por usuário</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={data.frequency_cap_impressions}
              onChange={(e) => onChange({ ...data, frequency_cap_impressions: parseInt(e.target.value) || 3 })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">A cada X horas</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={data.frequency_cap_hours}
              onChange={(e) => onChange({ ...data, frequency_cap_hours: parseInt(e.target.value) || 24 })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada usuário verá no máximo {data.frequency_cap_impressions} impressões a cada {data.frequency_cap_hours} horas
        </p>
      </div>
    </div>
  );
}
