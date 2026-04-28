import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, DollarSign, RotateCcw } from "lucide-react";
import type { CommissionTier, RoleCommissionConfig } from "@/data/employeeContractTemplate";
import { defaultCommissionByRole } from "@/data/employeeContractTemplate";

interface EmployeeCommissionEditorProps {
  role: string;
  config: RoleCommissionConfig;
  onChange: (config: RoleCommissionConfig) => void;
}

export default function EmployeeCommissionEditor({ role, config, onChange }: EmployeeCommissionEditorProps) {
  const defaultConfig = defaultCommissionByRole[role] || { hasCommission: false, description: "", tiers: [] };
  const isModified = JSON.stringify(config) !== JSON.stringify(defaultConfig);
  const isClients = config.unit === "clients";
  const unitLabel = isClients ? "empresa(s) ativa(s)" : "% da meta";

  const buildLabel = (t: CommissionTier): string => {
    const maxLabel = t.maxPercent !== null && t.maxPercent !== undefined ? `${t.maxPercent}` : "+";
    if (isClients) {
      if (t.minPercent === t.maxPercent) {
        return `${t.minPercent} empresa${t.minPercent === 1 ? "" : "s"} ativa${t.minPercent === 1 ? "" : "s"} — ${t.value} por cliente/mês`;
      }
      return `De ${t.minPercent} a ${maxLabel} empresas ativas — ${t.value} por cliente/mês`;
    }
    return t.value === "R$ 0,00"
      ? `Até ${t.maxPercent || 0}% da meta — sem comissão`
      : `Entre ${t.minPercent}% e ${maxLabel}% da meta — comissão de ${t.value}`;
  };

  const updateTier = (index: number, field: keyof CommissionTier, value: any) => {
    const newTiers = [...config.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    newTiers[index].label = buildLabel(newTiers[index]);
    onChange({ ...config, tiers: newTiers });
  };

  const addTier = () => {
    const lastTier = config.tiers[config.tiers.length - 1];
    const step = isClients ? 1 : 30;
    const newMin = lastTier ? ((lastTier.maxPercent ?? (isClients ? 10 : 150)) + (isClients ? 1 : 0)) : (isClients ? 1 : 0);
    const newTier: CommissionTier = {
      minPercent: newMin,
      maxPercent: newMin + step,
      value: "R$ 0,00",
      label: "",
    };
    newTier.label = buildLabel(newTier);
    onChange({ ...config, tiers: [...config.tiers, newTier] });
  };

  const removeTier = (index: number) => {
    onChange({ ...config, tiers: config.tiers.filter((_, i) => i !== index) });
  };

  const resetToDefault = () => {
    onChange({ ...defaultConfig });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Faixas de Comissão
          </CardTitle>
          <div className="flex items-center gap-2">
            {isModified && (
              <Button variant="ghost" size="sm" onClick={resetToDefault}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Restaurar Padrão
              </Button>
            )}
            {isModified && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-xs">
                Editado
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={config.hasCommission}
            onCheckedChange={(checked) =>
              onChange({
                ...config,
                hasCommission: checked,
                tiers: checked && config.tiers.length === 0 ? defaultConfig.tiers : config.tiers,
                description: checked && !config.description ? defaultConfig.description : config.description,
              })
            }
          />
          <Label>Este cargo possui comissão</Label>
        </div>

        {config.hasCommission && (
          <>
            <div>
              <Label>Descrição da base de cálculo</Label>
              <Input
                value={config.description}
                onChange={(e) => onChange({ ...config, description: e.target.value })}
                placeholder="Ex: atingimento de meta de vendas"
              />
            </div>

            <div className="space-y-3">
              <Label>Faixas</Label>
              {config.tiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">De ({isClients ? "qtd. clientes" : "%"})</Label>
                      <Input
                        type="number"
                        value={tier.minPercent}
                        onChange={(e) => updateTier(index, "minPercent", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Até ({isClients ? "qtd. clientes" : "%"})</Label>
                      <Input
                        type="number"
                        value={tier.maxPercent ?? ""}
                        onChange={(e) =>
                          updateTier(index, "maxPercent", e.target.value ? Number(e.target.value) : null)
                        }
                        placeholder="∞"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor</Label>
                      <Input
                        value={tier.value}
                        onChange={(e) => updateTier(index, "value", e.target.value)}
                        placeholder="R$ 0,00"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeTier(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTier} className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Faixa
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
