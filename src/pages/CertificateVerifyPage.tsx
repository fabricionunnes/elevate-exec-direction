// Verificação PÚBLICA de certificado da UNV Academy.
// /certificado (busca) e /certificado/:code (verificação direta — link do LinkedIn).
// Usa a RPC academy_verify_certificate (security definer, aberta pra anon).
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, ShieldCheck, ShieldX, Search, Loader2 } from "lucide-react";
import logoUrl from "@/assets/logo-unv-oficial.png";

interface VerifiedCert {
  holder_name: string;
  kind: string;
  title: string;
  total_hours: number | null;
  issued_at: string;
  certificate_code: string;
}

export default function CertificateVerifyPage() {
  const { code: codeParam } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [input, setInput] = useState(codeParam || "");
  const [cert, setCert] = useState<VerifiedCert | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const verify = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setLoading(true);
    setNotFound(false);
    setCert(null);
    try {
      const { data } = await (supabase.rpc as any)("academy_verify_certificate", { p_code: clean });
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.certificate_code) setCert(row as VerifiedCert);
      else setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (codeParam) void verify(codeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  return (
    <div className="min-h-screen bg-[#0D2B5E] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Cabeçalho navy */}
          <div className="bg-[#0D2B5E] px-6 py-5 flex items-center justify-between">
            <div className="bg-white rounded-lg px-3 py-1.5">
              <img src={logoUrl} alt="UNV" className="h-8" />
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-sm">UNV Academy</p>
              <p className="text-white/60 text-xs">Verificação de certificado</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Busca */}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) navigate(`/certificado/${encodeURIComponent(input.trim())}`);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Código do certificado (ex.: UNV-AB2C-3DEF)"
                className="text-slate-900"
              />
              <Button type="submit" disabled={loading || !input.trim()} className="bg-[#CC1B1B] hover:bg-[#a51515] shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </form>

            {loading && (
              <div className="py-8 flex flex-col items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="h-6 w-6 animate-spin" />
                Verificando...
              </div>
            )}

            {!loading && cert && (
              <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-50 p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <ShieldCheck className="h-5 w-5" />
                  Certificado autêntico
                </div>
                <div className="space-y-1.5 text-sm text-slate-700">
                  <p><span className="font-semibold">Emitido para:</span> {cert.holder_name}</p>
                  <p>
                    <span className="font-semibold">{cert.kind === "aula" ? "Aula" : "Trilha"}:</span> {cert.title}
                  </p>
                  {cert.total_hours ? (
                    <p><span className="font-semibold">Carga horária:</span> {cert.total_hours}h</p>
                  ) : null}
                  <p>
                    <span className="font-semibold">Emitido em:</span>{" "}
                    {new Date(cert.issued_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                  <p className="text-xs text-slate-500 pt-1">Código: {cert.certificate_code}</p>
                </div>
              </div>
            )}

            {!loading && notFound && (
              <div className="rounded-xl border-2 border-red-400/50 bg-red-50 p-5">
                <div className="flex items-center gap-2 text-red-600 font-bold mb-1">
                  <ShieldX className="h-5 w-5" />
                  Certificado não encontrado
                </div>
                <p className="text-sm text-slate-600">
                  Confira se o código foi digitado exatamente como aparece no certificado.
                </p>
              </div>
            )}

            {!loading && !cert && !notFound && (
              <div className="py-6 flex flex-col items-center gap-2 text-slate-400 text-sm text-center">
                <GraduationCap className="h-10 w-10" />
                Digite o código impresso no certificado para confirmar a autenticidade.
              </div>
            )}
          </div>

          <div className="bg-slate-50 px-6 py-3 text-center text-[11px] text-slate-400 border-t">
            UNV Holdings — Universidade Nacional de Vendas · unvholdings.com.br
          </div>
        </div>
      </div>
    </div>
  );
}
