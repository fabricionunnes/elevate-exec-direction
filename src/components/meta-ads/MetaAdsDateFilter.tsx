import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface MetaAdsDateFilterProps {
  dateStart: string;
  dateStop: string;
  onDateStartChange: (v: string) => void;
  onDateStopChange: (v: string) => void;
}

export const MetaAdsDateFilter = ({ dateStart, dateStop, onDateStartChange, onDateStopChange }: MetaAdsDateFilterProps) => {
  const setRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    onDateStartChange(start.toISOString().split("T")[0]);
    onDateStopChange(end.toISOString().split("T")[0]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 flex-wrap">
        <Input type="date" value={dateStart} onChange={(e) => onDateStartChange(e.target.value)} className="h-8 text-xs w-[130px] min-w-0" />
        <span className="text-xs text-muted-foreground">até</span>
        <Input type="date" value={dateStop} onChange={(e) => onDateStopChange(e.target.value)} className="h-8 text-xs w-[130px] min-w-0" />
      </div>
      <div className="flex gap-1 flex-wrap">
        <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setRange(7)}>7d</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setRange(14)}>14d</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setRange(30)}>30d</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setRange(90)}>90d</Button>
      </div>
    </div>
  );
};
