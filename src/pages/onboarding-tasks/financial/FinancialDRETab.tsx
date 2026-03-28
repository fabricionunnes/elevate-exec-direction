import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  invoices: any[];
  payables: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  group_name: string;
  dre_line: string | null;
  sort_order: number;
}

interface ManualEntry {
  id: string;
  type: string;
  category_id: string | null;
  amount_cents: number;
  due_date: string;
  status: string;
  paid_amount_cents: number | null;
}

export default function FinancialDRETab({ invoices, payables, formatCurrency, formatCurrencyCents }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [catRes, entRes] = await Promise.all([
      supabase.from("staff_financial_categories").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("staff_financial_entries").select("*").order("due_date"),
    ]);
    if (catRes.data) setCategories(catRes.data as any);
    if (entRes.data) setEntries(entRes.data as any);
  };

  const selectedDate = parse(selectedMonth, "yyyy-MM", new Date());

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedMonth(format(date, "yyyy-MM"));
    }
  };

  const monthLabel = format(selectedDate, "MMMM yyyy", { locale: ptBR }).replace(/^./, c => c.toUpperCase());

  const dreData = useMemo(() => {
    // 1. Receita bruta from invoices with paid_at in the month
    const monthInvoices = invoices.filter(i => i.status === "paid" && i.paid_at?.startsWith(selectedMonth));
    const receitaBrutaInvoices = monthInvoices.reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents), 0) / 100;

    // 2. Manual entries by category
    const monthEntries = entries.filter(e => e.due_date?.startsWith(selectedMonth) && e.status === "paid");
    const entriesByLine: Record<string, number> = {};

    monthEntries.forEach(e => {
      const cat = categories.find(c => c.id === e.category_id);
      if (cat?.dre_line) {
        if (!entriesByLine[cat.dre_line]) entriesByLine[cat.dre_line] = 0;
        entriesByLine[cat.dre_line] += (e.paid_amount_cents || e.amount_cents) / 100;
      }
    });

    // 3. Payables: filtra por paid_date no mês
    const monthPayables = payables.filter((p: any) => p.status === "paid" && p.paid_date?.startsWith(selectedMonth));
    const totalPayables = monthPayables.reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0), 0);

    // Build DRE lines
    const receitaBruta = receitaBrutaInvoices + (entriesByLine["receita_bruta"] || 0);
    const deducoes = entriesByLine["deducoes"] || 0;
    const receitaLiquida = receitaBruta - deducoes;

    const despPessoal = (entriesByLine["despesas_pessoal"] || 0);
    const despAdmin = (entriesByLine["despesas_admin"] || 0);
    const despComerciais = (entriesByLine["despesas_comerciais"] || 0);

    // If no categorized payables, put all payables in admin
    const uncategorizedPayables = totalPayables - Object.values(entriesByLine).filter((_, i) => i > 1).reduce((a, b) => a + b, 0);

    const totalDespOperacionais = despPessoal + despAdmin + despComerciais + (uncategorizedPayables > 0 ? uncategorizedPayables : 0);
    const ebitda = receitaLiquida - totalDespOperacionais;

    const despFinanceiras = entriesByLine["despesas_financeiras"] || 0;
    const resultadoLiquido = ebitda - despFinanceiras - (entriesByLine["investimentos"] || 0);

    return {
      lines: [
        { label: "RECEITA BRUTA", value: receitaBruta, isHeader: true, isPositive: true },
        { label: "  Receita de Serviços (Faturas)", value: receitaBrutaInvoices, isSubItem: true },
        { label: "  Receitas Manuais", value: entriesByLine["receita_bruta"] || 0, isSubItem: true },
        { label: "", value: 0, isSeparator: true },
        { label: "(-) DEDUÇÕES SOBRE RECEITA", value: deducoes, isHeader: true, isNegative: true },
        { label: "", value: 0, isSeparator: true },
        { label: "= RECEITA LÍQUIDA", value: receitaLiquida, isTotal: true },
        { label: "", value: 0, isSeparator: true },
        { label: "DESPESAS OPERACIONAIS", value: totalDespOperacionais, isHeader: true, isNegative: true },
        { label: "  Despesas com Pessoal", value: despPessoal, isSubItem: true },
        { label: "  Despesas Administrativas", value: despAdmin + (uncategorizedPayables > 0 ? uncategorizedPayables : 0), isSubItem: true },
        { label: "  Despesas Comerciais", value: despComerciais, isSubItem: true },
        { label: "", value: 0, isSeparator: true },
        { label: "= EBITDA", value: ebitda, isTotal: true, highlight: true },
        { label: "", value: 0, isSeparator: true },
        { label: "(-) Despesas Financeiras", value: despFinanceiras, isNegative: true },
        { label: "(-) Investimentos / Depreciação", value: entriesByLine["investimentos"] || 0, isNegative: true },
        { label: "", value: 0, isSeparator: true },
        { label: "= RESULTADO LÍQUIDO", value: resultadoLiquido, isTotal: true, highlight: true, isFinal: true },
      ],
    };
  }, [invoices, payables, entries, categories, selectedMonth]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            DRE - Demonstração do Resultado
          </h2>
          <p className="text-sm text-muted-foreground">Visão completa de receitas, custos e resultado</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[220px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {monthLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              locale={ptBR}
              captionLayout="dropdown-buttons"
              fromYear={2020}
              toYear={2030}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {dreData.lines.map((line, i) => {
              if (line.isSeparator) return <div key={i} className="h-px" />;

              return (
                <div
                  key={i}
                  className={`flex items-center justify-between px-6 py-3 ${
                    line.isHeader ? "bg-muted/50 font-semibold" : ""
                  } ${line.isTotal ? "font-bold text-base" : ""} ${
                    line.highlight ? "bg-primary/5" : ""
                  } ${line.isFinal ? "bg-primary/10 text-lg" : ""} ${
                    line.isSubItem ? "text-sm text-muted-foreground pl-10" : ""
                  }`}
                >
                  <span>{line.label}</span>
                  <span className={`tabular-nums ${
                    line.value > 0 && (line.isPositive || line.isTotal)
                      ? "text-emerald-600"
                      : line.value < 0 || line.isNegative
                      ? "text-destructive"
                      : ""
                  } ${line.isFinal && line.value >= 0 ? "text-emerald-600" : ""} ${
                    line.isFinal && line.value < 0 ? "text-destructive" : ""
                  }`}>
                    {line.isSubItem || line.isHeader || line.isTotal || line.isFinal || line.isNegative
                      ? formatCurrency(line.value)
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        * Receitas são calculadas a partir das faturas pagas + lançamentos manuais. Despesas vêm de contas a pagar + lançamentos manuais categorizados.
      </p>
    </div>
  );
}
