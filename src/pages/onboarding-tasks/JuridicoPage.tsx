import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, Search, RefreshCw, Scale, Phone, Building2,
  FileText, Trash2, AlertTriangle, User, Settings, Save,
  MessageSquare, Info, Download, StickyNote, ChevronDown, Gavel,
  Receipt, ExternalLink, Mail, Calculator, Clock, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type JuridicoStatus = "sem_resposta" | "em_negociacao" | "acionado_judicialmente" | "resolvido";

interface ContractDoc {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

interface JuridicoEntry {
  id: string;
  company_id: string | null;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  cnpj: string | null;
  amount_due_cents: number;
  contract_url: string | null;
  source: "manual" | "auto" | "excluded";
  is_active: boolean;
  added_at: string;
  notes: string | null;
  status: JuridicoStatus;
  process_number: string | null;
  overdue_days?: number;
  overdue_invoice_count?: number;
  invoice_id?: string | null;
  contracts?: ContractDoc[];
  company_status?: string | null;
  email?: string | null;
}

interface AutoOverdueRow {
  company_id: string;
  company_name: string;
  phone: string | null;
  cnpj: string | null;
  email: string | null;
  total_overdue_cents: number;
  oldest_due_date: string;
  invoice_id: string;
  invoice_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CONFIG_ID = "00000000-0000-0000-0000-000000000001";
// Cliente devedor só entra no Jurídico automaticamente com mais de 30 dias de atraso.
// Abaixo disso, só vai pro Jurídico manualmente (toggle/adicionar).
const OVERDUE_THRESHOLD_DAYS = 30;

const STATUS_CONFIG: Record<JuridicoStatus, { label: string; className: string }> = {
  sem_resposta:           { label: "Sem resposta",           className: "border-slate-400 text-slate-600 bg-slate-100 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300" },
  em_negociacao:          { label: "Em negociação",          className: "border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300" },
  acionado_judicialmente: { label: "Acionado judicialmente", className: "border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:bg-red-950 dark:text-red-300" },
  resolvido:              { label: "Resolvido",              className: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function JuridicoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<JuridicoEntry[]>([]);
  const [search, setSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<JuridicoEntry | null>(null);
  const [removing, setRemoving] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  // Config state
  const [showConfig, setShowConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessageTemplate, setConfigMessageTemplate] = useState("");
  const [configInstanceName, setConfigInstanceName] = useState<string>("");
  const [whatsappInstances, setWhatsappInstances] = useState<Array<{ instance_name: string; status: string }>>([]);

  // Notes dialog
  const [notesTarget, setNotesTarget] = useState<JuridicoEntry | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  // Status dialog
  const [statusTarget, setStatusTarget] = useState<JuridicoEntry | null>(null);
  const [statusValue, setStatusValue] = useState<JuridicoStatus>("sem_resposta");
  const [processNumberValue, setProcessNumberValue] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const isAdmin = ["master", "admin"].includes(currentRole || "");

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/onboarding-tasks/login"); return; }
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!staff) { navigate("/onboarding-tasks/login"); return; }
      const role = staff.role as string;
      if (!["master", "admin", "juridico"].includes(role)) {
        navigate("/onboarding-tasks");
        return;
      }
      setCurrentStaffId(staff.id);
      setCurrentRole(role);
    };
    checkAuth();
  }, [navigate]);

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Manual juridico entries
      const { data: manualRows, error: manualErr } = await supabase
        .from("juridico_clientes")
        .select("*")
        .order("added_at", { ascending: false });
      if (manualErr) throw manualErr;

      // 2. Overdue invoices (30+ days)
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - OVERDUE_THRESHOLD_DAYS);
      const thresholdStr = thresholdDate.toISOString().slice(0, 10);

      const { data: overdueInvs, error: overdueErr } = await supabase
        .from("company_invoices")
        .select("id, company_id, amount_cents, due_date")
        .in("status", ["overdue", "pending"])
        .lt("due_date", thresholdStr)
        .not("company_id", "is", null);
      if (overdueErr) throw overdueErr;

      // All company IDs involved
      const autoCompanyIds = [...new Set((overdueInvs || []).map(i => i.company_id as string))];

      // 3. Company info + status + email
      let companiesMap = new Map<string, { name: string; phone: string | null; cnpj: string | null; status: string | null; email: string | null }>();
      if (autoCompanyIds.length > 0) {
        const { data: companies } = await supabase
          .from("onboarding_companies")
          .select("id, name, phone, cnpj, status, email")
          .in("id", autoCompanyIds);
        (companies || []).forEach(c =>
          companiesMap.set(c.id, { name: c.name, phone: c.phone, cnpj: c.cnpj, status: c.status ?? null, email: (c as any).email ?? null })
        );
      }

      // 4. Group overdue invoices by company (count + total)
      const autoByCompany = new Map<string, AutoOverdueRow>();
      (overdueInvs || []).forEach(inv => {
        const cid = inv.company_id as string;
        const existing = autoByCompany.get(cid);
        if (!existing) {
          autoByCompany.set(cid, {
            company_id: cid,
            company_name: companiesMap.get(cid)?.name || "Empresa",
            phone: companiesMap.get(cid)?.phone || null,
            cnpj: companiesMap.get(cid)?.cnpj || null,
            email: companiesMap.get(cid)?.email || null,
            total_overdue_cents: inv.amount_cents || 0,
            oldest_due_date: inv.due_date || "",
            invoice_id: inv.id,
            invoice_count: 1,
          });
        } else {
          existing.total_overdue_cents += inv.amount_cents || 0;
          existing.invoice_count += 1;
          if (inv.due_date && (!existing.oldest_due_date || inv.due_date < existing.oldest_due_date)) {
            existing.oldest_due_date = inv.due_date;
          }
        }
      });

      // Build manual map for dedup
      const manualMap = new Map<string, typeof manualRows[0]>();
      (manualRows || []).forEach(r => { if (r.company_id) manualMap.set(r.company_id, r); });

      const result: JuridicoEntry[] = [];

      // Manual active entries — also fetch their company status
      const manualCompanyIds = (manualRows || [])
        .filter(r => r.is_active && r.source !== "excluded" && r.company_id)
        .map(r => r.company_id as string);

      let manualCompaniesMap = new Map<string, { status: string | null; email: string | null; cnpj: string | null }>();
      if (manualCompanyIds.length > 0) {
        const { data: mcs } = await supabase
          .from("onboarding_companies")
          .select("id, status, email, cnpj")
          .in("id", manualCompanyIds);
        (mcs || []).forEach(c => manualCompaniesMap.set(c.id, {
          status: c.status ?? null,
          email: (c as any).email ?? null,
          cnpj: (c as any).cnpj ?? null,
        }));
      }

      (manualRows || []).forEach(r => {
        if (r.is_active && r.source !== "excluded") {
          // count overdue invoices for this manual entry
          const autoData = r.company_id ? autoByCompany.get(r.company_id) : undefined;
          const companyInfo = r.company_id ? manualCompaniesMap.get(r.company_id) : undefined;
          const overdueDays = autoData?.oldest_due_date
            ? differenceInDays(new Date(), parseISO(autoData.oldest_due_date + "T12:00:00"))
            : (r.added_at ? differenceInDays(new Date(), parseISO(r.added_at)) : 0);
          result.push({
            ...r,
            status: (r.status as JuridicoStatus) || "sem_resposta",
            process_number: (r as any).process_number || null,
            overdue_days: overdueDays,
            overdue_invoice_count: autoData?.invoice_count ?? 0,
            company_status: companyInfo?.status ?? null,
            email: companyInfo?.email ?? null,
            cnpj: r.cnpj || companyInfo?.cnpj || null,
          } as JuridicoEntry);
        }
      });

      // Auto-detected
      autoByCompany.forEach((row) => {
        const manual = manualMap.get(row.company_id);
        if (manual && (manual.is_active || manual.source === "excluded")) return;
        const days = row.oldest_due_date
          ? differenceInDays(new Date(), parseISO(row.oldest_due_date + "T12:00:00"))
          : 0;
        result.push({
          id: `auto-${row.company_id}`,
          company_id: row.company_id,
          company_name: row.company_name,
          contact_name: null,
          phone: row.phone,
          cnpj: row.cnpj,
          amount_due_cents: row.total_overdue_cents,
          contract_url: null,
          source: "auto",
          is_active: true,
          added_at: row.oldest_due_date || new Date().toISOString(),
          notes: null,
          status: "sem_resposta",
          process_number: null,
          overdue_days: days,
          overdue_invoice_count: row.invoice_count,
          invoice_id: row.invoice_id,
          company_status: companiesMap.get(row.company_id)?.status ?? null,
          email: row.email,
        });
      });

      result.sort((a, b) => b.amount_due_cents - a.amount_due_cents);

      // 5. Batch-fetch contracts
      const allCompanyIds = result.map(e => e.company_id).filter(Boolean) as string[];
      if (allCompanyIds.length > 0) {
        const { data: docs } = await supabase
          .from("onboarding_documents")
          .select("id, file_name, file_path, file_size, created_at, company_id")
          .in("company_id", allCompanyIds)
          .eq("category", "contract")
          .order("created_at", { ascending: false });

        if (docs && docs.length > 0) {
          const docsByCompany = new Map<string, ContractDoc[]>();
          docs.forEach(d => {
            const cid = d.company_id as string;
            if (!docsByCompany.has(cid)) docsByCompany.set(cid, []);
            docsByCompany.get(cid)!.push({
              id: d.id,
              file_name: d.file_name,
              file_path: d.file_path,
              file_size: d.file_size,
              created_at: d.created_at,
            });
          });
          result.forEach(entry => {
            if (entry.company_id) entry.contracts = docsByCompany.get(entry.company_id) || [];
          });
        }
      }

      setEntries(result);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (currentRole) loadData(); }, [currentRole, loadData]);

  // ── Load config ──────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const [{ data: cfg }, { data: instances }] = await Promise.all([
        supabase.from("juridico_config").select("*").eq("id", CONFIG_ID).maybeSingle(),
        supabase.from("whatsapp_instances").select("instance_name, status").order("instance_name"),
      ]);
      if (cfg) {
        setConfigMessageTemplate(cfg.message_template || "");
        setConfigInstanceName(cfg.whatsapp_instance_name || "");
      }
      setWhatsappInstances(instances || []);
    } catch {
      toast.error("Erro ao carregar configurações");
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      const { error } = await supabase
        .from("juridico_config")
        .update({
          whatsapp_instance_name: configInstanceName || null,
          message_template: configMessageTemplate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", CONFIG_ID);
      if (error) throw error;
      toast.success("Configurações salvas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setConfigSaving(false);
    }
  };

  useEffect(() => { if (showConfig) loadConfig(); }, [showConfig, loadConfig]);

  // ── Download contract ─────────────────────────────────────────────────────────
  const downloadContract = async (doc: ContractDoc) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const res = await fetch(
        `https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/storage-signed-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ bucket: "onboarding-documents", path: doc.file_path }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao gerar link");
      window.open(result.signedUrl, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Erro ao baixar contrato");
    }
  };

  // ── Remove ────────────────────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      if (removeTarget.source === "manual" && !removeTarget.id.startsWith("auto-")) {
        const { error } = await supabase
          .from("juridico_clientes")
          .update({ is_active: false, removed_at: new Date().toISOString() })
          .eq("id", removeTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("juridico_clientes")
          .upsert({
            company_id: removeTarget.company_id,
            company_name: removeTarget.company_name,
            contact_name: removeTarget.contact_name,
            phone: removeTarget.phone,
            cnpj: removeTarget.cnpj,
            amount_due_cents: removeTarget.amount_due_cents,
            source: "excluded",
            is_active: false,
            removed_at: new Date().toISOString(),
            added_by_staff_id: currentStaffId,
          }, { onConflict: "company_id" });
        if (error) throw error;
      }
      toast.success(`${removeTarget.company_name} removida do Jurídico`);
      setRemoveTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    } finally {
      setRemoving(false);
    }
  };

  // ── Notes ─────────────────────────────────────────────────────────────────────
  const openNotes = (entry: JuridicoEntry) => {
    setNotesTarget(entry);
    setNotesValue(entry.notes || "");
  };

  const saveNotes = async () => {
    if (!notesTarget) return;
    setNotesSaving(true);
    try {
      if (notesTarget.id.startsWith("auto-")) {
        const { error } = await supabase
          .from("juridico_clientes")
          .upsert({
            company_id: notesTarget.company_id,
            company_name: notesTarget.company_name,
            contact_name: notesTarget.contact_name,
            phone: notesTarget.phone,
            cnpj: notesTarget.cnpj,
            amount_due_cents: notesTarget.amount_due_cents,
            source: "manual",
            is_active: true,
            notes: notesValue,
            added_by_staff_id: currentStaffId,
          }, { onConflict: "company_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("juridico_clientes")
          .update({ notes: notesValue, updated_at: new Date().toISOString() })
          .eq("id", notesTarget.id);
        if (error) throw error;
      }
      toast.success("Observações salvas!");
      setNotesTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setNotesSaving(false);
    }
  };

  // ── Status ────────────────────────────────────────────────────────────────────
  const openStatus = (entry: JuridicoEntry) => {
    setStatusTarget(entry);
    setStatusValue(entry.status || "sem_resposta");
    setProcessNumberValue(entry.process_number || "");
  };

  const saveStatus = async () => {
    if (!statusTarget) return;
    setStatusSaving(true);
    try {
      if (statusTarget.id.startsWith("auto-")) {
        const { error } = await supabase
          .from("juridico_clientes")
          .upsert({
            company_id: statusTarget.company_id,
            company_name: statusTarget.company_name,
            contact_name: statusTarget.contact_name,
            phone: statusTarget.phone,
            cnpj: statusTarget.cnpj,
            amount_due_cents: statusTarget.amount_due_cents,
            source: "manual",
            is_active: true,
            status: statusValue,
            process_number: statusValue === "acionado_judicialmente" ? processNumberValue : null,
            added_by_staff_id: currentStaffId,
          }, { onConflict: "company_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("juridico_clientes")
          .update({
            status: statusValue,
            process_number: statusValue === "acionado_judicialmente" ? processNumberValue : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", statusTarget.id);
        if (error) throw error;
      }
      toast.success("Status atualizado!");
      setStatusTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setStatusSaving(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.company_name.toLowerCase().includes(q) ||
      (e.contact_name || "").toLowerCase().includes(q) ||
      (e.phone || "").includes(q) ||
      (e.cnpj || "").includes(q) ||
      (e.email || "").toLowerCase().includes(q)
    );
  });

  const totalDue = filtered.reduce((s, e) => s + e.amount_due_cents, 0);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copiado!`);
    }).catch(() => {
      toast.error("Não foi possível copiar");
    });
  };

  const goToCompanyFinancial = (entry: JuridicoEntry) => {
    if (entry.company_id) {
      navigate(`/onboarding-tasks/companies/${entry.company_id}?tab=financial`);
    }
  };

  const companyStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const s = status.toLowerCase();

    const STATUS_MAP: Record<string, { label: string; cls: string }> = {
      ativo:     { label: "Ativo",     cls: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
      active:    { label: "Ativo",     cls: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
      inativo:   { label: "Inativo",   cls: "border-slate-300 text-slate-600 bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400" },
      inactive:  { label: "Inativo",   cls: "border-slate-300 text-slate-600 bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400" },
      cancelado: { label: "Cancelado", cls: "border-red-300 text-red-600 bg-red-50 dark:border-red-700 dark:bg-red-950 dark:text-red-400" },
      cancelled: { label: "Cancelado", cls: "border-red-300 text-red-600 bg-red-50 dark:border-red-700 dark:bg-red-950 dark:text-red-400" },
      canceled:  { label: "Cancelado", cls: "border-red-300 text-red-600 bg-red-50 dark:border-red-700 dark:bg-red-950 dark:text-red-400" },
      churned:   { label: "Cancelado", cls: "border-red-300 text-red-600 bg-red-50 dark:border-red-700 dark:bg-red-950 dark:text-red-400" },
      paused:    { label: "Pausado",   cls: "border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400" },
      pausado:   { label: "Pausado",   cls: "border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400" },
    };

    const match = STATUS_MAP[s];
    const label = match?.label ?? status;
    const cls   = match?.cls   ?? "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400";

    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cls}`}>
        {label}
      </span>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #111827 50%, #0d1b2a 100%)" }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 border-b border-white/10" style={{ background: "rgba(10,15,30,0.85)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/onboarding-tasks")}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="shrink-0 p-2 rounded-xl shadow-lg" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 0 16px rgba(168,85,247,0.45)" }}>
                <Scale className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm leading-tight text-white">Jurídico</h1>
                <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>Clientes em cobrança judicial</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => navigate("/onboarding-tasks/financeiro/recorrencias")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-300 border border-blue-500/40 hover:bg-blue-500/20 transition-colors"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Financeiro</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowConfig(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showConfig ? "bg-violet-500/30 border-violet-400/60 text-violet-300" : "text-white/60 border-white/20 hover:bg-white/10 hover:text-white"}`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Config</span>
              </button>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/60 border border-white/20 hover:bg-white/10 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total */}
          <div className="relative overflow-hidden rounded-2xl p-4 border border-white/10" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(99,102,241,0.12))", boxShadow: "0 4px 24px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }} />
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>Total no Jurídico</p>
              <div className="p-1.5 rounded-lg" style={{ background: "rgba(124,58,237,0.3)" }}>
                <Scale className="h-3.5 w-3.5 text-violet-300" />
              </div>
            </div>
            <p className="text-3xl font-black text-white tabular-nums">{filtered.length}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>empresas</p>
          </div>

          {/* Valor Total */}
          <div className="relative overflow-hidden rounded-2xl p-4 border border-white/10" style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.12))", boxShadow: "0 4px 24px rgba(239,68,68,0.15), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: "linear-gradient(90deg, #ef4444, #f87171)" }} />
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>Valor Total Devido</p>
              <div className="p-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.3)" }}>
                <Receipt className="h-3.5 w-3.5 text-red-300" />
              </div>
            </div>
            <p className="text-xl font-black text-red-300 tabular-nums leading-tight">{fmtBRL(totalDue)}</p>
          </div>

          {/* Manual */}
          <div className="relative overflow-hidden rounded-2xl p-4 border border-white/10" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(124,58,237,0.12))", boxShadow: "0 4px 24px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: "linear-gradient(90deg, #8b5cf6, #c084fc)" }} />
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>Manuais</p>
              <div className="p-1.5 rounded-lg" style={{ background: "rgba(139,92,246,0.3)" }}>
                <User className="h-3.5 w-3.5 text-violet-300" />
              </div>
            </div>
            <p className="text-3xl font-black text-violet-300 tabular-nums">{filtered.filter(e => e.source === "manual").length}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>adicionados</p>
          </div>

          {/* Auto */}
          <div className="relative overflow-hidden rounded-2xl p-4 border border-white/10" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.12))", boxShadow: "0 4px 24px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: "linear-gradient(90deg, #f59e0b, #fbbf24)" }} />
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>Automáticos</p>
              <div className="p-1.5 rounded-lg" style={{ background: "rgba(245,158,11,0.3)" }}>
                <Clock className="h-3.5 w-3.5 text-amber-300" />
              </div>
            </div>
            <p className="text-3xl font-black text-amber-300 tabular-nums">{filtered.filter(e => e.source === "auto").length}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>+{OVERDUE_THRESHOLD_DAYS}d atraso</p>
          </div>
        </div>

        {/* ── Config panel ── */}
        {showConfig && (
          <div className="rounded-2xl border border-violet-500/30 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.08))", boxShadow: "0 4px 24px rgba(124,58,237,0.12)" }}>
            <div className="px-5 pt-4 pb-3 border-b border-violet-500/20 flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ background: "rgba(124,58,237,0.3)" }}>
                <MessageSquare className="h-4 w-4 text-violet-300" />
              </div>
              <span className="text-sm font-semibold text-white">Configuração — Notificação Jurídico</span>
            </div>
            <div className="px-5 py-4 space-y-4">
              {configLoading ? (
                <div className="flex items-center gap-2 text-sm py-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-white/70">Instância WhatsApp</Label>
                    <Select value={configInstanceName || "none"} onValueChange={v => setConfigInstanceName(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm text-white border-white/20" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <SelectValue placeholder="Selecione uma instância..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sem instância configurada —</SelectItem>
                        {whatsappInstances.map(inst => (
                          <SelectItem key={inst.instance_name} value={inst.instance_name}>
                            {inst.instance_name}
                            {inst.status === "open" && <span className="ml-2 text-xs text-emerald-500">(conectada)</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-white/70">Mensagem enviada ao cliente</Label>
                    <Textarea
                      className="min-h-[120px] text-sm font-mono text-white border-white/20"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                      value={configMessageTemplate}
                      onChange={e => setConfigMessageTemplate(e.target.value)}
                      placeholder="Digite a mensagem..."
                    />
                    <div className="flex items-start gap-1.5 text-xs rounded-lg p-2.5 border border-violet-500/30" style={{ background: "rgba(124,58,237,0.12)", color: "rgba(255,255,255,0.55)" }}>
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-400" />
                      <span>
                        Variáveis:{" "}
                        <code className="px-1 py-0.5 rounded text-violet-300" style={{ background: "rgba(124,58,237,0.3)" }}>{"{{nome_empresa}}"}</code>{" "}
                        <code className="px-1 py-0.5 rounded text-violet-300" style={{ background: "rgba(124,58,237,0.3)" }}>{"{{valor_devido}}"}</code>{" "}
                        <code className="px-1 py-0.5 rounded text-violet-300" style={{ background: "rgba(124,58,237,0.3)" }}>{"{{telefone}}"}</code>
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowConfig(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      Fechar
                    </button>
                    <button
                      onClick={saveConfig}
                      disabled={configSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                    >
                      {configSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Salvar configuração
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.35)" }} />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 border border-white/15 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
            style={{ background: "rgba(255,255,255,0.06)" }}
            placeholder="Buscar por empresa, contato, telefone, e-mail ou CNPJ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
                </div>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Carregando...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="p-4 rounded-2xl" style={{ background: "rgba(124,58,237,0.15)" }}>
                <Scale className="h-10 w-10 text-violet-400 opacity-50" />
              </div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Nenhuma empresa no Jurídico</p>
            </div>
          ) : (
            <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.25), rgba(99,102,241,0.15), rgba(124,58,237,0.1))", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider min-w-[200px]" style={{ color: "rgba(255,255,255,0.6)" }}>Empresa</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider min-w-[180px]" style={{ color: "rgba(255,255,255,0.6)" }}>Contato</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider min-w-[120px] font-mono" style={{ color: "rgba(255,255,255,0.6)" }}>CNPJ</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider min-w-[140px]" style={{ color: "rgba(255,255,255,0.6)" }}>Valor / Parcelas</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider min-w-[160px]" style={{ color: "rgba(255,255,255,0.6)" }}>Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider min-w-[140px]" style={{ color: "rgba(255,255,255,0.6)" }}>Contrato</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider w-24" style={{ color: "rgba(255,255,255,0.6)" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className="group transition-colors"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,58,237,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent")}
                    >

                      {/* ── Empresa ── */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => goToCompanyFinancial(entry)}
                            disabled={!entry.company_id}
                            className="flex items-start gap-2 group/btn text-left disabled:cursor-default"
                            title="Abrir financeiro da empresa"
                          >
                            <Building2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }} />
                            <div>
                              <span className="font-semibold text-sm text-white group-hover/btn:text-violet-300 transition-colors leading-tight">
                                {entry.company_name}
                              </span>
                              {entry.company_id && (
                                <ExternalLink className="inline h-3 w-3 ml-1 opacity-0 group-hover/btn:opacity-50 transition-opacity text-violet-300" />
                              )}
                            </div>
                          </button>
                          <div className="flex items-center gap-1.5 pl-5 flex-wrap">
                            {companyStatusBadge(entry.company_status)}
                            {entry.source === "manual" ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-violet-500/50 text-violet-300" style={{ background: "rgba(124,58,237,0.2)" }}>Manual</span>
                            ) : (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-amber-500/50 text-amber-300" style={{ background: "rgba(245,158,11,0.2)" }}>Auto</span>
                            )}
                          </div>
                          {entry.notes && (
                            <p className="text-[11px] italic pl-5 line-clamp-1 max-w-[200px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                              "{entry.notes}"
                            </p>
                          )}
                        </div>
                      </td>

                      {/* ── Contato ── */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {entry.contact_name && (
                            <div className="flex items-center gap-1.5 text-sm font-medium text-white">
                              <User className="h-3 w-3 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
                              {entry.contact_name}
                            </div>
                          )}
                          {entry.phone && (
                            <button
                              onClick={() => copyToClipboard(entry.phone!, "Telefone")}
                              className="flex items-center gap-1.5 text-xs group/copy text-left"
                              style={{ color: "rgba(255,255,255,0.5)" }}
                              title="Clique para copiar"
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="group-hover/copy:text-blue-300 transition-colors">{entry.phone}</span>
                            </button>
                          )}
                          {entry.email && (
                            <button
                              onClick={() => copyToClipboard(entry.email!, "E-mail")}
                              className="flex items-center gap-1.5 text-xs group/copy text-left"
                              style={{ color: "rgba(255,255,255,0.5)" }}
                              title="Clique para copiar"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="break-all group-hover/copy:text-blue-300 transition-colors">{entry.email}</span>
                            </button>
                          )}
                          {!entry.contact_name && !entry.phone && !entry.email && (
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                          )}
                        </div>
                      </td>

                      {/* ── CNPJ ── */}
                      <td className="px-4 py-3 font-mono text-xs">
                        {entry.cnpj ? (
                          <button
                            onClick={() => copyToClipboard(entry.cnpj!, "CNPJ")}
                            className="group/copy text-left transition-colors"
                            style={{ color: "rgba(255,255,255,0.45)" }}
                            title="Clique para copiar"
                          >
                            <span className="group-hover/copy:text-violet-300 transition-colors">{entry.cnpj}</span>
                          </button>
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                        )}
                      </td>

                      {/* ── Valor + Parcelas + Dias ── */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="font-black text-sm text-red-400 tabular-nums">{fmtBRL(entry.amount_due_cents)}</span>
                          {(entry.overdue_invoice_count ?? 0) > 0 && (
                            <div className="flex items-center gap-1">
                              <Receipt className="h-3 w-3 text-amber-400" />
                              <span className="text-[11px] text-amber-300">
                                {entry.overdue_invoice_count} {entry.overdue_invoice_count === 1 ? "parcela" : "parcelas"}
                              </span>
                            </div>
                          )}
                          {(entry.overdue_days ?? 0) > 0 && (
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border ${
                              (entry.overdue_days ?? 0) > 60
                                ? "border-red-500/50 text-red-300"
                                : (entry.overdue_days ?? 0) > 30
                                ? "border-orange-500/50 text-orange-300"
                                : "border-amber-500/50 text-amber-300"
                            }`} style={{
                              background: (entry.overdue_days ?? 0) > 60
                                ? "rgba(239,68,68,0.15)"
                                : (entry.overdue_days ?? 0) > 30
                                ? "rgba(249,115,22,0.15)"
                                : "rgba(245,158,11,0.15)",
                              boxShadow: (entry.overdue_days ?? 0) > 60
                                ? "0 0 8px rgba(239,68,68,0.25)"
                                : (entry.overdue_days ?? 0) > 30
                                ? "0 0 8px rgba(249,115,22,0.25)"
                                : "0 0 8px rgba(245,158,11,0.25)",
                            }}>
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="text-[11px] font-bold tabular-nums">{entry.overdue_days}d em atraso</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ── Status ── */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => openStatus(entry)}
                            title="Clique para alterar"
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all w-fit ${
                              entry.status === "sem_resposta"
                                ? "border-slate-500/50 text-slate-300"
                                : entry.status === "em_negociacao"
                                ? "border-blue-500/50 text-blue-300"
                                : entry.status === "acionado_judicialmente"
                                ? "border-red-500/50 text-red-300"
                                : "border-emerald-500/50 text-emerald-300"
                            }`}
                            style={{
                              background: entry.status === "sem_resposta"
                                ? "rgba(100,116,139,0.2)"
                                : entry.status === "em_negociacao"
                                ? "rgba(59,130,246,0.2)"
                                : entry.status === "acionado_judicialmente"
                                ? "rgba(239,68,68,0.2)"
                                : "rgba(16,185,129,0.2)",
                              boxShadow: entry.status === "sem_resposta"
                                ? "0 0 8px rgba(100,116,139,0.2)"
                                : entry.status === "em_negociacao"
                                ? "0 0 8px rgba(59,130,246,0.2)"
                                : entry.status === "acionado_judicialmente"
                                ? "0 0 8px rgba(239,68,68,0.2)"
                                : "0 0 8px rgba(16,185,129,0.2)",
                            }}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              entry.status === "sem_resposta" ? "bg-slate-400" :
                              entry.status === "em_negociacao" ? "bg-blue-400" :
                              entry.status === "acionado_judicialmente" ? "bg-red-400" :
                              "bg-emerald-400"
                            }`} style={{ boxShadow: entry.status === "sem_resposta" ? "0 0 4px rgba(148,163,184,0.6)" : entry.status === "em_negociacao" ? "0 0 4px rgba(96,165,250,0.6)" : entry.status === "acionado_judicialmente" ? "0 0 4px rgba(248,113,113,0.6)" : "0 0 4px rgba(52,211,153,0.6)" }} />
                            {STATUS_CONFIG[entry.status]?.label || entry.status}
                            <ChevronDown className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                          </button>
                          {entry.status === "acionado_judicialmente" && entry.process_number && (
                            <div className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                              <Gavel className="h-3 w-3 shrink-0" />
                              <span className="font-mono text-[11px]">{entry.process_number}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ── Contrato ── */}
                      <td className="px-4 py-3">
                        {(entry.contracts && entry.contracts.length > 0) ? (
                          <div className="flex flex-col gap-1">
                            {entry.contracts.map(doc => (
                              <button
                                key={doc.id}
                                onClick={() => downloadContract(doc)}
                                className="flex items-center gap-1.5 text-xs text-left group/dl"
                                style={{ color: "rgba(167,139,250,0.8)" }}
                                title={doc.file_name}
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                                <span className="truncate max-w-[110px] group-hover/dl:text-violet-300 transition-colors group-hover/dl:underline">{doc.file_name}</span>
                                <Download className="h-3 w-3 shrink-0 opacity-0 group-hover/dl:opacity-100 transition-opacity text-violet-300" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                        )}
                      </td>

                      {/* ── Ações ── */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors ${entry.notes ? "text-amber-400 hover:bg-amber-500/20" : "hover:bg-white/10"}`}
                            style={{ color: entry.notes ? undefined : "rgba(255,255,255,0.4)" }}
                            title={entry.notes ? "Ver/editar observações" : "Adicionar observação"}
                            onClick={() => openNotes(entry)}
                          >
                            <StickyNote className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-violet-500/20 transition-colors"
                            style={{ color: "rgba(255,255,255,0.4)" }}
                            title="Alterar status"
                            onClick={() => openStatus(entry)}
                            onMouseEnter={e => (e.currentTarget.style.color = "#a78bfa")}
                            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                          >
                            <Gavel className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors"
                              style={{ color: "rgba(255,255,255,0.4)" }}
                              title="Remover do Jurídico"
                              onClick={() => setRemoveTarget(entry)}
                              onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-center pb-4" style={{ color: "rgba(255,255,255,0.25)" }}>
          Empresas aparecem automaticamente quando faturas ficam com +{OVERDUE_THRESHOLD_DAYS} dias de atraso,
          ou quando enviadas manualmente pelo módulo Financeiro.
        </p>
      </div>

      {/* ── Remove confirmation ── */}
      <AlertDialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Remover do Jurídico?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeTarget?.company_name}</strong> será removida da lista jurídica.
              {removeTarget?.source === "auto" && (
                <span> Como foi detectada automaticamente, será marcada como excluída e não voltará a aparecer automaticamente.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Notes dialog ── */}
      <Dialog open={!!notesTarget} onOpenChange={open => !open && setNotesTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <StickyNote className="h-4 w-4 text-amber-500" />
              Observações — {notesTarget?.company_name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              className="min-h-[140px] text-sm"
              placeholder="Adicione observações sobre este cliente..."
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setNotesTarget(null)}>Cancelar</Button>
            <Button size="sm" onClick={saveNotes} disabled={notesSaving}>
              {notesSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Status dialog ── */}
      <Dialog open={!!statusTarget} onOpenChange={open => !open && setStatusTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Gavel className="h-4 w-4 text-violet-500" />
              Status — {statusTarget?.company_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(STATUS_CONFIG) as [JuridicoStatus, { label: string; className: string }][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setStatusValue(key)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left
                    ${statusValue === key
                      ? "ring-2 ring-offset-1 ring-violet-500 " + cfg.className
                      : "border-border text-foreground hover:bg-muted"
                    }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    key === "sem_resposta" ? "bg-slate-400" :
                    key === "em_negociacao" ? "bg-blue-500" :
                    key === "acionado_judicialmente" ? "bg-red-500" :
                    "bg-emerald-500"
                  }`} />
                  {cfg.label}
                </button>
              ))}
            </div>
            {statusValue === "acionado_judicialmente" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Gavel className="h-3.5 w-3.5 text-red-500" />
                  Número do processo
                </Label>
                <Input
                  className="font-mono text-sm"
                  placeholder="Ex: 1234567-89.2024.8.26.0001"
                  value={processNumberValue}
                  onChange={e => setProcessNumberValue(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setStatusTarget(null)}>Cancelar</Button>
            <Button size="sm" onClick={saveStatus} disabled={statusSaving}>
              {statusSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Salvar status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
