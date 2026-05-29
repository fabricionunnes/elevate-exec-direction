import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, KeyRound, Building2, User, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Company { id: string; name: string; }
interface Lesson { id: string; title: string; checkin_code: string | null; }

export default function CheckinPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [params] = useSearchParams();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(true);
  const [lessonError, setLessonError] = useState("");

  // Form state
  const [attendeeName, setAttendeeName] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [code, setCode] = useState(params.get("code") || "");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Load lesson info (anon)
  useEffect(() => {
    if (!lessonId) { setLessonError("Link inválido."); setLoadingLesson(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("pe_lessons")
        .select("id, title, checkin_code, status")
        .eq("id", lessonId)
        .eq("status", "active")
        .maybeSingle();
      if (error || !data) {
        setLessonError("Aula não encontrada ou não está ativa.");
      } else {
        setLesson(data as Lesson);
      }
      setLoadingLesson(false);
    })();
  }, [lessonId]);

  // Company autocomplete
  useEffect(() => {
    if (companyQuery.trim().length < 2) { setCompanies([]); setShowDropdown(false); return; }
    setLoadingCompanies(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .ilike("name", `%${companyQuery.trim()}%`)
        .limit(8);
      setCompanies(data || []);
      setShowDropdown(true);
      setLoadingCompanies(false);
    }, 300);
    return () => clearTimeout(t);
  }, [companyQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectCompany = (c: Company) => {
    setSelectedCompany(c);
    setCompanyQuery(c.name);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!attendeeName.trim()) { setError("Informe seu nome."); return; }
    if (!companyQuery.trim()) { setError("Informe sua empresa."); return; }
    if (!code.trim()) { setError("Informe o código da aula."); return; }
    if (!lesson) return;

    if (lesson.checkin_code && code.trim().toUpperCase() !== lesson.checkin_code.toUpperCase()) {
      setError("Código incorreto. Verifique com o instrutor.");
      return;
    }

    setSubmitting(true);

    // Check if already checked in today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from("pe_checkin_log")
      .select("id")
      .eq("lesson_id", lesson.id)
      .ilike("attendee_name", attendeeName.trim())
      .gte("checked_in_at", todayStart.toISOString())
      .maybeSingle();

    if (existing) {
      setSubmitting(false);
      setError("Você já registrou presença nesta aula hoje.");
      return;
    }

    const { error: insertError } = await supabase
      .from("pe_checkin_log")
      .insert({
        lesson_id: lesson.id,
        attendee_name: attendeeName.trim(),
        company_name: selectedCompany?.name || companyQuery.trim(),
      });

    setSubmitting(false);
    if (insertError) {
      // Unique constraint violation = already checked in
      if (insertError.code === "23505") {
        setError("Você já registrou presença nesta aula hoje.");
      } else {
        setError(`Erro: ${insertError.message} (${insertError.code})`);
      }
    } else {
      setDone(true);
    }
  };

  // ── Render ──
  const bg = "min-h-screen flex items-center justify-center px-4 py-8";
  const cardStyle = "w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1629] p-8 shadow-2xl";

  if (loadingLesson) {
    return (
      <div className={bg} style={{ background: "#060d1f" }}>
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (lessonError) {
    return (
      <div className={bg} style={{ background: "#060d1f" }}>
        <div className={cardStyle}>
          <p className="text-red-400 text-center text-sm">{lessonError}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={bg} style={{ background: "#060d1f" }}>
        <div className={cn(cardStyle, "text-center")}>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-emerald-500/20 p-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Presença registrada!</h2>
          <p className="text-white/60 text-sm mb-1">
            Olá, <span className="text-white font-medium">{attendeeName}</span>
          </p>
          <p className="text-white/40 text-xs">
            Sua presença na aula <span className="text-violet-300">"{lesson?.title}"</span> foi confirmada.
          </p>
          <p className="text-white/30 text-xs mt-4">Você já pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={bg} style={{ background: "#060d1f" }}>
      <div className={cardStyle}>
        {/* Header */}
        <div className="text-center mb-7">
          <div className="flex justify-center mb-3">
            <div className="rounded-full bg-violet-500/20 p-3">
              <KeyRound className="h-7 w-7 text-violet-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Confirmar Presença</h1>
          <p className="text-sm text-violet-300 mt-1 font-medium">"{lesson?.title}"</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company */}
          <div className="space-y-1.5" ref={dropdownRef}>
            <Label className="text-white/70 text-sm flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Empresa
            </Label>
            <div className="relative">
              <Input
                value={companyQuery}
                onChange={e => { setCompanyQuery(e.target.value); setSelectedCompany(null); }}
                placeholder="Digite o nome da sua empresa..."
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30 pr-8"
                autoComplete="off"
              />
              {loadingCompanies && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-white/30" />
              )}
              {!loadingCompanies && companyQuery.length >= 2 && (
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
              )}
              {showDropdown && companies.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-lg border border-white/15 bg-[#141d35] shadow-xl overflow-hidden">
                  {companies.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCompany(c)}
                      className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-violet-500/20 hover:text-white transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && companies.length === 0 && companyQuery.length >= 2 && !loadingCompanies && (
                <div className="absolute z-50 w-full mt-1 rounded-lg border border-white/15 bg-[#141d35] shadow-xl px-4 py-3">
                  <p className="text-xs text-white/40">Empresa não encontrada — continue digitando o nome exato.</p>
                </div>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-sm flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Seu nome completo
            </Label>
            <Input
              value={attendeeName}
              onChange={e => setAttendeeName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
            />
          </div>

          {/* Code */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-sm flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Código da aula
            </Label>
            <Input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: UNV-482A"
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 font-mono tracking-widest text-center text-lg"
              maxLength={12}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full font-semibold"
            style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Presença"}
          </Button>
        </form>

        <p className="text-center text-white/20 text-xs mt-5">Ponto de Encontro · UNV</p>
      </div>
    </div>
  );
}
