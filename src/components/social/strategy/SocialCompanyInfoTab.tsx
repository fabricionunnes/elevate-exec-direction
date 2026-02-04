import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Sparkles, Building2, MessageSquare, Hash, BookOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SocialCompanyInfoTabProps {
  projectId: string;
}

interface CompanyProfile {
  id: string;
  brand_identity: string | null;
  positioning: string | null;
  tone_of_voice: string | null;
  communication_rules: string | null;
  official_hashtags: string[] | null;
  ai_generated_summary: string | null;
  ai_generated_at: string | null;
}

export const SocialCompanyInfoTab = ({ projectId }: SocialCompanyInfoTabProps) => {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasBriefing, setHasBriefing] = useState(false);

  // Form state
  const [brandIdentity, setBrandIdentity] = useState("");
  const [positioning, setPositioning] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [communicationRules, setCommunicationRules] = useState("");
  const [hashtags, setHashtags] = useState("");

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      // Load company profile
      const { data: profileData, error: profileError } = await supabase
        .from("social_company_profiles")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (profileError && profileError.code !== "PGRST116") throw profileError;

      if (profileData) {
        setProfile(profileData);
        setBrandIdentity(profileData.brand_identity || "");
        setPositioning(profileData.positioning || "");
        setToneOfVoice(profileData.tone_of_voice || "");
        setCommunicationRules(profileData.communication_rules || "");
        setHashtags(profileData.official_hashtags?.join(", ") || "");
      }

      // Check if briefing exists
      const { data: briefingData } = await supabase
        .from("social_briefing_forms")
        .select("id, is_complete")
        .eq("project_id", projectId)
        .single();

      setHasBriefing(!!briefingData?.is_complete);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const hashtagsArray = hashtags
        .split(",")
        .map(h => h.trim())
        .filter(h => h.length > 0);

      const { error } = await supabase
        .from("social_company_profiles")
        .upsert({
          project_id: projectId,
          brand_identity: brandIdentity || null,
          positioning: positioning || null,
          tone_of_voice: toneOfVoice || null,
          communication_rules: communicationRules || null,
          official_hashtags: hashtagsArray.length > 0 ? hashtagsArray : null,
        }, { onConflict: "project_id" });

      if (error) throw error;
      toast.success("Informações salvas!");
      loadData();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateFromBriefing = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-generate-company-profile", {
        body: { projectId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Perfil gerado com sucesso!");
        loadData();
      }
    } catch (error) {
      console.error("Error generating:", error);
      toast.error("Erro ao gerar perfil");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header with AI generation */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Resumo Executivo</h3>
          <p className="text-sm text-muted-foreground">
            Identidade e diretrizes da marca para criação de conteúdo
          </p>
        </div>
        {hasBriefing && (
          <Button 
            onClick={handleGenerateFromBriefing} 
            disabled={generating}
            variant="outline"
            className="gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar do Briefing
          </Button>
        )}
      </div>

      {!hasBriefing && (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="p-6 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h4 className="font-medium mb-1">Briefing não preenchido</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Complete o Briefing | Social Media para gerar automaticamente as informações da empresa
            </p>
            <Badge variant="secondary">Aba "Briefing | Social Media"</Badge>
          </CardContent>
        </Card>
      )}

      {/* AI Generated Summary */}
      {profile?.ai_generated_summary && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Resumo Gerado por IA</CardTitle>
            </div>
            {profile.ai_generated_at && (
              <CardDescription className="text-xs">
                Gerado em {new Date(profile.ai_generated_at).toLocaleDateString("pt-BR")}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{profile.ai_generated_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Manual Fields */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <CardTitle className="text-base">Identidade da Marca</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Essência da Marca</Label>
              <Textarea
                placeholder="Descreva a essência, valores e personalidade da marca..."
                value={brandIdentity}
                onChange={(e) => setBrandIdentity(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Posicionamento</Label>
              <Textarea
                placeholder="Como a marca quer ser percebida no mercado..."
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <CardTitle className="text-base">Comunicação</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tom de Voz</Label>
              <Textarea
                placeholder="Ex: Profissional mas acessível, técnico com simplicidade..."
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Regras de Comunicação</Label>
              <Textarea
                placeholder="O que usar e evitar na comunicação..."
                value={communicationRules}
                onChange={(e) => setCommunicationRules(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              <CardTitle className="text-base">Hashtags Oficiais</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Hashtags (separadas por vírgula)</Label>
              <Input
                placeholder="#marca, #produto, #segmento"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Essas hashtags serão sugeridas automaticamente nos conteúdos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Informações
        </Button>
      </div>
    </div>
  );
};
