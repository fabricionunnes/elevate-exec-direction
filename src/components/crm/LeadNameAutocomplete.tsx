import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Building2, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LeadAutocompleteSelection {
  source: "lead" | "company";
  name: string;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  company?: string | null;
  role?: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
  address?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  zipcode?: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (selection: LeadAutocompleteSelection) => void;
  placeholder?: string;
  id?: string;
}

interface Suggestion {
  source: "lead" | "company";
  id: string;
  label: string;
  sublabel?: string;
  data: LeadAutocompleteSelection;
}

export const LeadNameAutocomplete = ({ value, onChange, onSelect, placeholder, id }: Props) => {
  const [localValue, setLocalValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const like = `%${term}%`;
      const [leadsRes, companiesRes] = await Promise.all([
        supabase
          .from("crm_leads")
          .select("id, name, phone, email, document, company, role, city, state, segment")
          .or(`name.ilike.${like},company.ilike.${like}`)
          .limit(8),
        supabase
          .from("onboarding_companies")
          .select("id, name, cnpj, phone, email, segment, address_city, address_state, owner_name, owner_phone")
          .ilike("name", like)
          .limit(8),
      ]);

      const leadSuggestions: Suggestion[] = (leadsRes.data || []).map((l: any) => ({
        source: "lead",
        id: l.id,
        label: l.name,
        sublabel: [l.company, l.phone, l.email].filter(Boolean).join(" • "),
        data: {
          source: "lead",
          name: l.name,
          phone: l.phone,
          email: l.email,
          document: l.document,
          company: l.company,
          role: l.role,
          city: l.city,
          state: l.state,
          segment: l.segment,
        },
      }));

      const companySuggestions: Suggestion[] = (companiesRes.data || []).map((c: any) => ({
        source: "company",
        id: c.id,
        label: c.name,
        sublabel: [c.cnpj, c.phone || c.owner_phone, c.email].filter(Boolean).join(" • "),
        data: {
          source: "company",
          name: c.owner_name || c.name,
          phone: c.owner_phone || c.phone,
          email: c.email,
          document: c.cnpj,
          company: c.name,
          city: c.address_city,
          state: c.address_state,
          segment: c.segment,
        },
      }));

      setSuggestions([...leadSuggestions, ...companySuggestions]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    setJustSelected(false);
    onChange(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  };

  const handlePick = (s: Suggestion) => {
    setJustSelected(true);
    setLocalValue(s.data.name);
    onSelect(s.data);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={localValue}
        onChange={handleChange}
        onFocus={() => {
          if (!justSelected && suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-72 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
            </div>
          )}
          {suggestions.map((s) => (
            <button
              key={`${s.source}-${s.id}`}
              type="button"
              onClick={() => handlePick(s)}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b border-border/50 last:border-0"
              )}
            >
              {s.source === "company" ? (
                <Building2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              ) : (
                <User className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.label}</div>
                {s.sublabel && (
                  <div className="text-xs text-muted-foreground truncate">{s.sublabel}</div>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex-shrink-0 mt-1">
                {s.source === "company" ? "Empresa" : "Lead"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
