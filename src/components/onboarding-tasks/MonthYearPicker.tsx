import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthYearPickerProps {
  value: Date;
  onChange: (range: { start: Date; end: Date }) => void;
}

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const MonthYearPicker = ({ value, onChange }: MonthYearPickerProps) => {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  
  const selectedMonth = value.getMonth();
  const selectedYear = value.getFullYear();

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(viewYear, monthIndex, 1);
    onChange({
      start: startOfMonth(newDate),
      end: endOfMonth(newDate),
    });
    setOpen(false);
  };

  const handlePrevYear = () => setViewYear((y) => y - 1);
  const handleNextYear = () => setViewYear((y) => y + 1);

  const goToCurrentMonth = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    onChange({
      start: startOfMonth(now),
      end: endOfMonth(now),
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 justify-start text-left font-medium gap-2 min-w-[140px]",
            !value && "text-muted-foreground"
          )}
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="capitalize">
            {format(value, "MMMM yyyy", { locale: ptBR })}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3" align="start">
        {/* Year Navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrevYear}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{viewYear}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNextYear}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Months Grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((month, index) => {
            const isSelected = index === selectedMonth && viewYear === selectedYear;
            const isCurrentMonth = index === new Date().getMonth() && viewYear === new Date().getFullYear();
            
            return (
              <Button
                key={month}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-9 font-medium",
                  isCurrentMonth && !isSelected && "border border-primary/50 text-primary",
                  isSelected && "bg-primary text-primary-foreground"
                )}
                onClick={() => handleMonthSelect(index)}
              >
                {month}
              </Button>
            );
          })}
        </div>

        {/* Go to Today */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 text-xs text-muted-foreground"
          onClick={goToCurrentMonth}
        >
          Mês atual
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default MonthYearPicker;
