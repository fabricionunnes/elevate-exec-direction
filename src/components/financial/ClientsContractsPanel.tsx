import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Search, Users, FileText, Loader2, RefreshCw, Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export function ClientsContractsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [contracts, setContracts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("financial_contracts")
        .select(`*, company:company_id(name)`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error("Error loading contracts:", error);
      toast.error("Erro ao carregar contratos");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const filteredContracts = contracts.filter(c => 
    c.contract_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mrr = contracts
    .filter(c => c.status === "active")
    .reduce((sum, c) => {
      const value = Number(c.contract_value) || 0;
      if (c.billing_cycle === "monthly") return sum + value;
      if (c.billing_cycle === "quarterly") return sum + value / 3;
      if (c.billing_cycle === "semiannual") return sum + value / 6;
      if (c.billing_cycle === "annual") return sum + value / 12;
      return sum;
    }, 0);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clientes & Contratos</h2>
          <p className="text-muted-foreground">Gerencie contratos financeiros</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contratos Ativos</p>
                <p className="text-2xl font-bold">{contracts.filter(c => c.status === "active").length}</p>
              </div>
              <FileText className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">MRR</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(mrr)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ARR</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(mrr * 12)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar contratos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum contrato encontrado</TableCell></TableRow>
              ) : filteredContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">{contract.contract_name}</TableCell>
                  <TableCell>{contract.company?.name || "-"}</TableCell>
                  <TableCell>{formatCurrency(contract.contract_value)}</TableCell>
                  <TableCell>{contract.billing_cycle}</TableCell>
                  <TableCell>
                    <Badge variant={contract.status === "active" ? "default" : "secondary"}>
                      {contract.status === "active" ? "Ativo" : contract.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
