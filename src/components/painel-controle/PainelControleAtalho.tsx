// Atalho pro Painel de Controle na página inicial. Só aparece pro master.
import { Link } from "react-router-dom";
import { Gauge, ArrowRight } from "lucide-react";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

export function PainelControleAtalho() {
  const { loading, isMaster } = useStaffPermissions();
  if (loading || !isMaster) return null;
  return (
    <Link
      to="/painel-de-controle"
      className="mb-6 sm:mb-8 flex items-center justify-between gap-4 rounded-lg border border-[#CC1B1B] bg-[#0E0E0E] px-4 py-3 text-white shadow-lg transition hover:border-white"
      style={{ fontFamily: "Archivo, Inter, sans-serif" }}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#CC1B1B]"><Gauge className="h-5 w-5" /></span>
        <span>
          <span className="block text-[10px] uppercase tracking-[0.12em] text-white/60">Só o master vê</span>
          <span className="block text-base font-bold">Painel de Controle</span>
          <span className="block text-xs text-white/70">Caixa, vendas, tráfego, clientes, atendimento e IA num lugar só, com os registros por trás de cada número.</span>
        </span>
      </span>
      <span className="flex items-center gap-1 text-sm font-semibold whitespace-nowrap">Abrir <ArrowRight className="h-4 w-4" /></span>
    </Link>
  );
}
