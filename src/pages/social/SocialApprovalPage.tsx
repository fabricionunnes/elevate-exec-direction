import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Edit2, Instagram, Calendar, Clock, Hash, MessageSquare, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import confetti from "canvas-confetti";

interface ApprovalData {
  id: string;
  card: {
    id: string;
    content_type: string;
    theme: string;
    objective: string;
    creative_url: string | null;
    creative_type: string | null;
    final_caption: string | null;
    hashtags: string | null;
    cta: string | null;
    suggested_date: string | null;
    suggested_time: string | null;
  };
  status: string;
  expires_at: string;
  company_name: string | null;
}

export const SocialApprovalPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedAction, setSubmittedAction] = useState<"approved" | "adjustment_requested" | null>(null);

  useEffect(() => {
    if (token) {
      loadApprovalData();
    } else {
      setError("Token inválido");
      setLoading(false);
    }
  }, [token]);

  const loadApprovalData = async () => {
    try {
      const { data, error: fetchError } = await supabase.functions.invoke("social-get-approval", {
        body: { token },
      });

      if (fetchError) throw fetchError;

      if (data?.error) {
        setError(data.error);
      } else {
        setApprovalData(data);
      }
    } catch (error) {
      console.error("Error loading approval:", error);
      setError("Erro ao carregar conteúdo para aprovação");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const { error: submitError } = await supabase.functions.invoke("social-submit-approval", {
        body: { token, action: "approved" },
      });

      if (submitError) throw submitError;

      // Celebration!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setSubmitted(true);
      setSubmittedAction("approved");
    } catch (error) {
      console.error("Error approving:", error);
      setError("Erro ao enviar aprovação");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestAdjustment = async () => {
    if (!adjustmentNotes.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const { error: submitError } = await supabase.functions.invoke("social-submit-approval", {
        body: { token, action: "adjustment_requested", notes: adjustmentNotes.trim() },
      });

      if (submitError) throw submitError;

      setSubmitted(true);
      setSubmittedAction("adjustment_requested");
    } catch (error) {
      console.error("Error requesting adjustment:", error);
      setError("Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Ops!</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            {submittedAction === "approved" ? (
              <>
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Conteúdo Aprovado!</h2>
                <p className="text-muted-foreground">
                  Seu conteúdo foi aprovado e será publicado na data programada.
                </p>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mx-auto mb-4">
                  <Edit2 className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Ajuste Solicitado</h2>
                <p className="text-muted-foreground">
                  Recebemos sua solicitação de ajuste. Nossa equipe entrará em contato em breve.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!approvalData) {
    return null;
  }

  const { card, company_name } = approvalData;

  const contentTypeLabels: Record<string, string> = {
    feed: "Feed",
    reels: "Reels",
    stories: "Stories",
  };

  const objectiveLabels: Record<string, string> = {
    engagement: "Engajamento",
    authority: "Autoridade",
    conversion: "Conversão",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <Instagram className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Aprovação de Conteúdo</h1>
          {company_name && (
            <p className="text-muted-foreground">{company_name}</p>
          )}
        </div>

        {/* Content Preview */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{contentTypeLabels[card.content_type] || card.content_type}</Badge>
              <Badge variant="outline">{objectiveLabels[card.objective] || card.objective}</Badge>
            </div>
            <CardTitle className="text-lg mt-2">{card.theme}</CardTitle>
          </CardHeader>
        <CardContent className="space-y-4">
            {/* Creative Preview with Watermark - Protected against saving */}
            {card.creative_url && (
              <div 
                className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 select-none"
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              >
                {/* Aspect ratio based on content type */}
                <div className={card.content_type === "feed" ? "aspect-square" : "aspect-[9/16]"}>
                  {card.creative_type === "video" ? (
                    <video
                      src={card.creative_url}
                      controls
                      playsInline
                      controlsList="nodownload"
                      disablePictureInPicture
                      className="w-full h-full object-contain bg-black pointer-events-auto"
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  ) : (
                    <img
                      src={card.creative_url}
                      alt="Preview"
                      className="w-full h-full object-contain pointer-events-none"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  )}
                </div>
                {/* Transparent overlay to block all interactions with the image */}
                <div 
                  className="absolute inset-0 z-10"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  style={{ touchAction: "none" }}
                />
                {/* Watermark overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <div 
                    className="text-4xl sm:text-5xl font-bold text-white/30 rotate-[-30deg] select-none"
                    style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}
                  >
                    RASCUNHO
                  </div>
                </div>
              </div>
            )}

            {/* Caption */}
            {card.final_caption && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4" />
                  Legenda
                </div>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">
                  {card.final_caption}
                </p>
              </div>
            )}

            {/* Hashtags */}
            {card.hashtags && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Hash className="h-4 w-4" />
                  Hashtags
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 bg-muted p-3 rounded-lg">
                  {card.hashtags}
                </p>
              </div>
            )}

            {/* Schedule */}
            {(card.suggested_date || card.suggested_time) && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {card.suggested_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(card.suggested_date), "dd 'de' MMMM", { locale: ptBR })}
                  </div>
                )}
                {card.suggested_time && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {card.suggested_time.slice(0, 5)}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!showAdjustmentForm ? (
          <div className="space-y-3">
            <Button
              onClick={handleApprove}
              disabled={submitting}
              className="w-full h-12 text-lg gap-2 bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              Aprovar Conteúdo
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAdjustmentForm(true)}
              disabled={submitting}
              className="w-full h-12 text-lg gap-2"
            >
              <Edit2 className="h-5 w-5" />
              Solicitar Ajustes
            </Button>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Solicitar Ajustes</CardTitle>
              <CardDescription>
                Descreva o que você gostaria de ajustar neste conteúdo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Descreva os ajustes necessários..."
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAdjustmentForm(false);
                    setAdjustmentNotes("");
                  }}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleRequestAdjustment}
                  disabled={submitting || !adjustmentNotes.trim()}
                  className="flex-1 gap-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Enviar"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Powered by UNV Nexus
        </p>
      </div>
    </div>
  );
};
