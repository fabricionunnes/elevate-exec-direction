// Meus Certificados — todos os certificados do aluno num lugar só (menu próprio).
// Botões são LINKS diretos (window.open pós-async é bloqueado no iOS/PWA).
import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, ExternalLink, ShieldCheck } from "lucide-react";
import type { AcademyUserContext } from "./AcademyLayout";

interface CertRow {
  id: string;
  certificate_code: string;
  pdf_url: string | null;
  total_hours: number | null;
  issued_at: string;
  lesson_title: string | null;
  track_name: string | null;
}

export const AcademyCertificatesPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userContext.onboardingUserId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("academy_certificates")
        .select(`
          id, certificate_code, pdf_url, total_hours, issued_at,
          lesson:academy_lessons(title),
          track:academy_tracks(name)
        `)
        .eq("onboarding_user_id", userContext.onboardingUserId)
        .order("issued_at", { ascending: false });
      setCerts(
        (data || []).map((c: any) => ({
          id: c.id,
          certificate_code: c.certificate_code,
          pdf_url: c.pdf_url,
          total_hours: c.total_hours,
          issued_at: c.issued_at,
          lesson_title: c.lesson?.title || null,
          track_name: c.track?.name || null,
        }))
      );
      setLoading(false);
    })();
  }, [userContext.onboardingUserId]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Certificados</h1>
        <p className="text-muted-foreground mt-1">
          Cada aula concluída gera um certificado — e a trilha completa gera o certificado da trilha.
        </p>
      </div>

      {certs.length === 0 ? (
        <Card className="p-12 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Nenhum certificado ainda</h3>
          <p className="text-muted-foreground mb-4">
            Conclua sua primeira aula e o certificado aparece aqui na hora.
          </p>
          <Button asChild>
            <Link to="/academy/tracks">Ver trilhas</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {certs.map((cert) => (
            <Card key={cert.id}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="p-2.5 rounded-lg shrink-0"
                    style={{ background: "linear-gradient(135deg, #0D2B5E, #1a4a8a)" }}
                  >
                    <GraduationCap className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">
                        {cert.lesson_title || cert.track_name || "Certificado"}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {cert.lesson_title ? "Aula" : "Trilha"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cert.total_hours ? `${cert.total_hours}h · ` : ""}
                      {new Date(cert.issued_at).toLocaleDateString("pt-BR")} · Código {cert.certificate_code}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                    <a
                      href={`/#/certificado/${cert.certificate_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Página pública de verificação (pra compartilhar)"
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </a>
                  </Button>
                  {cert.pdf_url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir PDF
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AcademyCertificatesPage;
