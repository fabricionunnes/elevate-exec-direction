import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Users,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CostItem {
  id: string;
  name: string;
  description: string;
  value: number;
}

interface CACCalculatorCardProps {
  projectId: string;
  autoSalesCount?: number;
}

export const CACCalculatorCard = ({ projectId, autoSalesCount }: CACCalculatorCardProps) => {
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualSalesCount, setManualSalesCount] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", description: "", value: "" });

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString("pt-BR", { month: "long" });

  useEffect(() => {
    fetchCostItems();
  }, [projectId]);

  const fetchCostItems = async () => {
    try {
      const { data, error } = await supabase
        .from("cac_cost_items")
        .select("*")
        .eq("project_id", projectId)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setCostItems(
        (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description || "",
          value: item.value || 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching CAC cost items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim() || !newItem.value) {
      toast.error("Preencha o nome e valor do custo");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("cac_cost_items")
        .insert({
          project_id: projectId,
          name: newItem.name.trim(),
          description: newItem.description.trim() || null,
          value: parseFloat(newItem.value),
          month: currentMonth,
          year: currentYear,
        })
        .select()
        .single();

      if (error) throw error;

      setCostItems((prev) => [
        ...prev,
        { id: data.id, name: data.name, description: data.description || "", value: data.value },
      ]);
      setNewItem({ name: "", description: "", value: "" });
      setShowForm(false);
      toast.success("Custo adicionado!");
    } catch (error) {
      console.error("Error adding cost item:", error);
      toast.error("Erro ao adicionar custo");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const { error } = await supabase.from("cac_cost_items").delete().eq("id", id);
      if (error) throw error;
      setCostItems((prev) => prev.filter((item) => item.id !== id));
      toast.success("Custo removido");
    } catch (error) {
      console.error("Error deleting cost item:", error);
      toast.error("Erro ao remover custo");
    }
  };

  const totalCost = useMemo(() => costItems.reduce((sum, item) => sum + item.value, 0), [costItems]);
  const hasAutoSales = autoSalesCount !== undefined && autoSalesCount > 0;
  const salesNumber = hasAutoSales ? autoSalesCount : (parseInt(manualSalesCount) || 0);
  const cac = salesNumber > 0 ? totalCost / salesNumber : null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/[0.08] via-indigo-500/[0.05] to-cyan-500/[0.08] dark:from-violet-500/[0.15] dark:via-indigo-500/[0.10] dark:to-cyan-500/[0.15]" />
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-violet-500/10 to-transparent rounded-tr-full" />

      <CardHeader className="relative pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 text-primary-foreground shadow-lg shadow-primary/25">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Calculadora de CAC</CardTitle>
            <p className="text-xs text-muted-foreground capitalize">{monthName} {currentYear}</p>
          </div>
          <div className="ml-auto">
            <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-5">
        {/* Cost Items List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Custos de Aquisição</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="h-7 gap-1 text-xs text-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>

          {/* Add form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-xl border bg-card/80 backdrop-blur-sm space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do custo *</Label>
                    <Input
                      placeholder="Ex: Facebook Ads, Salário SDR..."
                      value={newItem.name}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      placeholder="Breve descrição (opcional)"
                      value={newItem.description}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor (R$) *</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={newItem.value}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, value: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => {
                        setShowForm(false);
                        setNewItem({ name: "", description: "", value: "" });
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={handleAddItem}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Items */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <AnimatePresence>
              {costItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="group flex items-center gap-2 p-2.5 rounded-lg border bg-card/60 backdrop-blur-sm hover:bg-card/90 transition-colors"
                >
                  <div className="h-2 w-2 rounded-full bg-gradient-to-r from-primary to-violet-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-primary whitespace-nowrap">
                    {formatCurrency(item.value)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>

            {costItems.length === 0 && !showForm && (
              <div className="text-center py-6 text-muted-foreground">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum custo adicionado</p>
                <p className="text-xs">Clique em "Adicionar" para começar</p>
              </div>
            )}
          </div>
        </div>

        {/* Total + Sales input */}
        {costItems.length > 0 && (
          <div className="space-y-4">
            {/* Total bar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-primary/10 to-violet-500/10 border border-primary/20">
              <span className="text-sm font-medium">Total de Custos</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(totalCost)}</span>
            </div>

            {/* Sales count */}
            {hasAutoSales ? (
              <div className="flex items-center justify-between p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-600" />
                  Vendas no mês
                </span>
                <span className="text-lg font-bold text-emerald-600">{autoSalesCount}</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Vendas realizadas no mês
                </Label>
                <Input
                  type="number"
                  placeholder="Quantidade de vendas"
                  value={manualSalesCount}
                  onChange={(e) => setManualSalesCount(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {/* CAC Result */}
            <AnimatePresence>
              {cac !== null && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-violet-500/5 p-5"
                >
                  <div className="absolute top-2 right-2">
                    <TrendingUp className="h-12 w-12 text-primary/10" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Seu CAC
                    </p>
                    <p className="text-3xl font-extrabold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                      {formatCurrency(cac)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      por cliente adquirido
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="text-center p-2.5 rounded-lg bg-card/80 border">
                      <p className="text-[10px] text-muted-foreground">Custo Total</p>
                      <p className="text-sm font-bold">{formatCurrency(totalCost)}</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-card/80 border">
                      <p className="text-[10px] text-muted-foreground">Vendas</p>
                      <p className="text-sm font-bold">{salesNumber}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
