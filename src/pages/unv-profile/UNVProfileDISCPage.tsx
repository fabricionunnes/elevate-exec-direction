import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Send, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, XAxis, YAxis, Bar, Tooltip } from "recharts";
import { toast } from "sonner";
import { getPublicBaseUrl } from "@/lib/publicDomain";

const PROFILE_LABELS: Record<string, { name: string; color: string; desc: string }> = {
  D: { name: "Dominância", color: "#ef4444", desc: "Foco em resultado, decisão rápida" },
  I: { name: "Influência", color: "#f59e0b", desc: "Comunicação, persuasão" },
  S: { name: "Estabilidade", color: "#10b981", desc: "Paciência, cooperação" },
  C: { name: "Conformidade", color: "#3b82f6", desc: "Precisão, análise" },
};

export default function UNVProfileDISCPage() {
  const [results, setResults] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profile_disc_results")
        .select("*, profile_employees(full_name, email, avatar_url)")
        .order("created_at", { ascending: false });
      setResults(data || []);
    })();
  }, []);

  const publicLink = `${getPublicBaseUrl()}/disc-publico`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      toast.success("Link público copiado! Qualquer pessoa pode abrir e responder.");
    } catch {
      // Fallback for browsers that block clipboard API
      const ta = document.createElement("textarea");
      ta.value = publicLink;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast.success("Link copiado!");
      } catch {
        toast.error("Não foi possível copiar. Copie manualmente: " + publicLink);
      }
      document.body.removeChild(ta);
    }
  };

  const filtered = results.filter(r =>
    !search || r.profile_employees?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Distribuição por perfil dominante
  const distribution = ["D", "I", "S", "C"].map(p => ({
    name: PROFILE_LABELS[p].name,
    value: results.filter(r => r.dominant_profile === p).length,
    fill: PROFILE_LABELS[p].color,
  }));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary" /> Perfil DISC</h1>
          <p className="text-sm text-muted-foreground">Mapa comportamental individual e do time</p>
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Link público do teste DISC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Compartilhe este link com qualquer pessoa (sem login). O resultado aparece abaixo automaticamente.
          </p>
          <div className="flex gap-2">
            <Input value={publicLink} readOnly className="font-mono text-sm bg-muted" />
            <Button onClick={copyLink} variant="outline" className="gap-2">
              <Copy className="w-4 h-4" /> Copiar
            </Button>
            <Button variant="outline" size="icon" onClick={() => window.open(publicLink, "_blank")}>
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Distribuição comportamental do time</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={distribution}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div>
        <Input placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(r => {
            const dom = PROFILE_LABELS[r.dominant_profile] || PROFILE_LABELS.D;
            const radarData = [
              { axis: "D", value: r.d_score || 0 },
              { axis: "I", value: r.i_score || 0 },
              { axis: "S", value: r.s_score || 0 },
              { axis: "C", value: r.c_score || 0 },
            ];
            return (
              <Card key={r.id}>
                <CardContent className="p-4 grid grid-cols-2 gap-3 items-center">
                  <div>
                    <p className="font-medium">{r.profile_employees?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground mb-2">{r.profile_employees?.email}</p>
                    <Badge style={{ backgroundColor: dom.color }} className="text-white">{dom.name}</Badge>
                    <p className="text-xs text-muted-foreground mt-2">{dom.desc}</p>
                  </div>
                  <div className="h-40">
                    <ResponsiveContainer>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="axis" />
                        <Radar dataKey="value" stroke={dom.color} fill={dom.color} fillOpacity={0.4} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="col-span-full text-sm text-muted-foreground text-center py-12">Nenhum resultado DISC ainda. Convide o time!</p>}
        </div>
      </div>
    </div>
  );
}
