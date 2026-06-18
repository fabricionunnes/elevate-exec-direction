import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, RotateCcw, FileText, Shield } from "lucide-react";
import type { SigningPageData, SignerStatus } from "@/types/signatures";
import { PdfDocumentViewer } from "@/components/signatures/PdfDocumentViewer";

const SIGNER_STATUS_LABELS: Record<SignerStatus, string> = {
  pending: "Pendente",
  viewed: "Visualizando",
  signed: "Assinou",
  declined: "Recusou",
};

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const [pageData, setPageData] = useState<SigningPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [allSigned, setAllSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!token) { setError("Token inválido"); setLoading(false); return; }
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-signing-page?token=${token}`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    })
      .then(r => r.json())
      .then(data => {
        if (!data.success) setError(data.error ?? "Erro ao carregar documento");
        else setPageData(data.data as SigningPageData);
      })
      .catch(() => setError("Erro de conexão"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!pageData || submitted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgba(255,255,255,0)",
      penColor: "#1a1a2e",
    });
    padRef.current = pad;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      pad.clear();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); pad.off(); };
  }, [pageData, submitted]);

  const clearPad = () => padRef.current?.clear();

  const handleSubmit = async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      alert("Por favor, desenhe sua assinatura antes de confirmar.");
      return;
    }
    if (!acceptedTerms) {
      alert("Você deve aceitar os termos para prosseguir.");
      return;
    }
    if (!token || !pageData) return;

    setSubmitting(true);
    try {
      const signatureImage = padRef.current.toDataURL("image/png");
      const deviceInfo = {
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
      };

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-signature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          token,
          signature_image: signatureImage,
          accepted_terms: true,
          device_info: deviceInfo,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Erro ao registrar assinatura");
      setSubmitted(true);
      setAllSigned(data.data.all_signed ?? false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro ao enviar assinatura");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Não foi possível carregar o documento</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-green-700">Assinatura registrada!</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Sua assinatura eletrônica foi registrada com validade jurídica conforme a MP 2.200-2/2001 e Lei 14.063/2020.
            </p>
            {allSigned && (
              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700">
                Todos os signatários assinaram. O PDF final será gerado e enviado por e-mail.
              </div>
            )}
            {!allSigned && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                Aguardando assinaturas dos demais signatários.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pageData) return null;

  const { envelope, signer, pdf_url, all_signers } = pageData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0D2B5E] text-white px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <FileText className="h-5 w-5" />
          <div>
            <h1 className="font-bold text-sm">UNV Nexus — Assinatura Eletrônica</h1>
            <p className="text-xs text-blue-200 truncate">{envelope.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Info do signatário */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-medium text-sm">Olá, <strong>{signer.name}</strong></p>
                <p className="text-xs text-muted-foreground">{signer.email}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {SIGNER_STATUS_LABELS[signer.status]}
              </Badge>
            </div>
            {envelope.message && (
              <div className="mt-3 bg-muted/50 rounded p-3 text-sm italic text-muted-foreground">
                {envelope.message}
              </div>
            )}
            {envelope.original_file_hash && (
              <p className="text-xs text-muted-foreground font-mono mt-2 truncate opacity-60">
                SHA-256: {envelope.original_file_hash}
              </p>
            )}
          </CardContent>
        </Card>

        {/* PDF */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Documento para Assinatura</CardTitle>
          </CardHeader>
          <CardContent>
            <PdfDocumentViewer url={pdf_url} />
          </CardContent>
        </Card>

        {/* Todos os signatários */}
        {all_signers.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Signatários ({all_signers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {all_signers.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${s.status === "signed" ? "bg-green-500" : s.status === "viewed" ? "bg-blue-400" : "bg-gray-300"}`} />
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground text-xs">({SIGNER_STATUS_LABELS[s.status]})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Área de assinatura */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Sua Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg relative bg-white" style={{ height: 160 }}>
              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: "100%", touchAction: "none", borderRadius: 6 }}
              />
              <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none select-none opacity-40">
                Desenhe sua assinatura aqui
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={clearPad} className="text-xs">
              <RotateCcw className="h-3 w-3 mr-1" /> Limpar
            </Button>

            {/* Aceite legal */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <p className="text-xs text-amber-800 font-medium">Declaração de aceite (obrigatório)</p>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={v => setAcceptedTerms(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="terms" className="text-xs text-amber-900 cursor-pointer leading-relaxed">
                  Declaro que li e concordo com o conteúdo do documento acima, e que minha assinatura eletrônica tem validade jurídica nos termos da <strong>MP 2.200-2/2001</strong> e da <strong>Lei 14.063/2020</strong>.
                </Label>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !acceptedTerms}
              className="w-full bg-[#0D2B5E] hover:bg-[#0D2B5E]/90"
              size="lg"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Registrando assinatura...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Assinatura Eletrônica
                </span>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao confirmar, sua assinatura será registrada com data, hora e IP para fins de autenticidade.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
