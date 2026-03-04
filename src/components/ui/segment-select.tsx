import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SegmentSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SegmentSelect({
  value,
  onValueChange,
  placeholder = "Selecione o segmento",
  className,
}: SegmentSelectProps) {
  const [segments, setSegments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSegment, setNewSegment] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSegments = async () => {
    const { data } = await supabase
      .from("company_segments")
      .select("name")
      .eq("is_active", true)
      .order("name");
    setSegments((data || []).map((s: any) => s.name));
    setLoading(false);
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  const handleAddSegment = async () => {
    const trimmed = newSegment.trim();
    if (!trimmed) return;
    if (segments.includes(trimmed)) {
      toast.error("Esse segmento já existe");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("company_segments")
      .insert({ name: trimmed });

    if (error) {
      toast.error("Erro ao adicionar segmento");
    } else {
      toast.success("Segmento adicionado");
      setNewSegment("");
      setAdding(false);
      await fetchSegments();
      onValueChange(trimmed);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Carregando..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {segments.map((seg) => (
          <SelectItem key={seg} value={seg}>
            {seg}
          </SelectItem>
        ))}

        <div className="border-t mt-1 pt-1 px-1 pb-1">
          {adding ? (
            <div className="flex items-center gap-1">
              <Input
                value={newSegment}
                onChange={(e) => setNewSegment(e.target.value)}
                placeholder="Nome do segmento"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSegment();
                  }
                  if (e.key === "Escape") setAdding(false);
                }}
                autoFocus
              />
              <Button
                size="sm"
                className="h-8 px-2"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddSegment();
                }}
                disabled={saving || !newSegment.trim()}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm h-8"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAdding(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Adicionar segmento
            </Button>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}
