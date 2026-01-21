import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUpCircle, ArrowDownCircle, RefreshCw, AlertTriangle, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InventoryMovement } from "./types";

interface Props {
  projectId: string;
}

const movementTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  purchase: { label: "Compra", icon: <ArrowUpCircle className="h-4 w-4" />, color: "bg-green-500/10 text-green-600" },
  sale: { label: "Venda", icon: <ArrowDownCircle className="h-4 w-4" />, color: "bg-blue-500/10 text-blue-600" },
  adjustment: { label: "Ajuste", icon: <RefreshCw className="h-4 w-4" />, color: "bg-amber-500/10 text-amber-600" },
  loss: { label: "Perda", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-red-500/10 text-red-600" },
  return: { label: "Devolução", icon: <RotateCcw className="h-4 w-4" />, color: "bg-purple-500/10 text-purple-600" },
};

export function ClientInventoryMovementsPanel({ projectId }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["inventory-movements", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_inventory_movements")
        .select(`
          *,
          product:client_inventory_products(id, name, base_unit)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as (InventoryMovement & { product: { id: string; name: string; base_unit: string } })[];
    },
  });

  const filteredMovements = movements.filter((m) => {
    const matchesSearch = m.product?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || m.movement_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const formatQuantity = (quantity: number, unit: string) => {
    return `${quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unit}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movimentações de Estoque</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="purchase">Compra</SelectItem>
              <SelectItem value="sale">Venda</SelectItem>
              <SelectItem value="adjustment">Ajuste</SelectItem>
              <SelectItem value="loss">Perda</SelectItem>
              <SelectItem value="return">Devolução</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredMovements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma movimentação encontrada
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Antes</TableHead>
                  <TableHead className="text-right">Depois</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((movement) => {
                  const config = movementTypeConfig[movement.movement_type] || movementTypeConfig.adjustment;
                  const unit = movement.product?.base_unit || "UN";
                  const isPositive = ["purchase", "return"].includes(movement.movement_type);

                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{movement.product?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={config.color}>
                          <span className="flex items-center gap-1">
                            {config.icon}
                            {config.label}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                        {isPositive ? "+" : "-"}{formatQuantity(Math.abs(movement.quantity), unit)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatQuantity(movement.quantity_before, unit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(movement.quantity_after, unit)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {movement.reference_type || "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {movement.notes || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
