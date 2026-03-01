import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Supplier {
  id: string;
  name: string;
}

interface SupplierAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  suppliers: Supplier[];
  onSupplierCreated: () => void;
}

export function SupplierAutocomplete({ value, onChange, suppliers, onSupplierCreated }: SupplierAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? suppliers.filter(s => s.name.toLowerCase().includes(value.toLowerCase()))
    : suppliers;

  const exactMatch = suppliers.some(s => s.name.toLowerCase() === value.trim().toLowerCase());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("financial_suppliers")
        .insert({ name: newSupplierName.trim() });
      if (error) throw error;
      toast.success("Fornecedor cadastrado!");
      onChange(newSupplierName.trim());
      setCreateDialogOpen(false);
      setNewSupplierName("");
      onSupplierCreated();
    } catch (err: any) {
      toast.error("Erro ao cadastrar fornecedor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Digite o nome do fornecedor..."
        autoComplete="off"
      />

      {open && (filtered.length > 0 || (value.trim() && !exactMatch)) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto"
        >
          {filtered.map(s => (
            <button
              key={s.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => {
                onChange(s.name);
                setOpen(false);
              }}
            >
              {s.name}
            </button>
          ))}

          {value.trim() && !exactMatch && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 border-t border-border text-primary font-medium"
              onClick={() => {
                setNewSupplierName(value.trim());
                setCreateDialogOpen(true);
                setOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Cadastrar "{value.trim()}"
            </button>
          )}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cadastrar Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Fornecedor</Label>
              <Input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Nome do fornecedor"
                autoFocus
              />
            </div>
            <Button onClick={handleCreateSupplier} className="w-full" disabled={saving || !newSupplierName.trim()}>
              {saving ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
