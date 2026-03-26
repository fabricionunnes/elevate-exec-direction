import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Loader2, Sparkles } from "lucide-react";
import { B2B_NICHES, BRAZILIAN_STATES } from "@/types/b2bProspection";
import { Textarea } from "@/components/ui/textarea";

interface SearchFiltersProps {
  onSearch: (params: { niches: string[]; state?: string; city?: string; limit?: number }) => void;
  loading: boolean;
}

export function SearchFilters({ onSearch, loading }: SearchFiltersProps) {
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [nicheInput, setNicheInput] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [limit, setLimit] = useState("20");
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredNiches = B2B_NICHES.filter(
    (n) => n.toLowerCase().includes(nicheInput.toLowerCase()) && !selectedNiches.includes(n)
  );

  const addNiche = (niche: string) => {
    if (!selectedNiches.includes(niche)) {
      setSelectedNiches([...selectedNiches, niche]);
    }
    setNicheInput("");
    setShowSuggestions(false);
  };

  const removeNiche = (niche: string) => {
    setSelectedNiches(selectedNiches.filter((n) => n !== niche));
  };

  const handleSearch = () => {
    const niches = selectedNiches.length > 0 ? selectedNiches : nicheInput ? [nicheInput] : [];
    onSearch({
      niches,
      state: state || undefined,
      city: city || undefined,
      limit: parseInt(limit),
    });
  };

  const handleAIFill = () => {
    // Simple AI-like parsing of the prompt
    const prompt = aiPrompt.toLowerCase();
    const matchedNiches = B2B_NICHES.filter((n) => prompt.includes(n.toLowerCase()));
    const matchedState = BRAZILIAN_STATES.find((s) => prompt.includes(s.toLowerCase()));

    if (matchedNiches.length) setSelectedNiches(matchedNiches);
    if (matchedState) setState(matchedState);

    setShowAI(false);
    setAiPrompt("");
  };

  return (
    <div className="space-y-4">
      {/* AI Prompt */}
      {showAI && (
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <Label className="text-sm font-medium">Descreva o perfil do cliente ideal</Label>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ex: Empresas de médio porte no interior de MG que provavelmente precisam de treinamento de vendas"
            className="min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAIFill} disabled={!aiPrompt}>
              <Sparkles className="h-4 w-4 mr-1" />
              Preencher Filtros
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAI(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Niche selector */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Nicho / Segmento</Label>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6"
              onClick={() => setShowAI(!showAI)}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              IA
            </Button>
          </div>
          <div className="relative">
            <Input
              value={nicheInput}
              onChange={(e) => {
                setNicheInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Digite ou selecione um nicho..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && nicheInput) {
                  e.preventDefault();
                  addNiche(nicheInput);
                }
              }}
            />
            {showSuggestions && nicheInput && filteredNiches.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                {filteredNiches.slice(0, 10).map((niche) => (
                  <button
                    key={niche}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => addNiche(niche)}
                  >
                    {niche}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedNiches.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedNiches.map((niche) => (
                <Badge key={niche} variant="secondary" className="gap-1">
                  {niche}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeNiche(niche)} />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* State */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Estado</Label>
          <Select value={state} onValueChange={(v) => { setState(v === "all" ? "" : v); setCity(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {BRAZILIAN_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* City */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Cidade</Label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex: São Paulo"
            disabled={!state}
          />
        </div>
      </div>

      {/* Bottom row: limit + search button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Resultados</Label>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["10", "25", "50", "100", "200"].map((v) => (
                <SelectItem key={v} value={v}>{v} resultados</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSearch}
          disabled={loading || (!selectedNiches.length && !nicheInput)}
          className="min-w-[160px]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Buscar Leads
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
