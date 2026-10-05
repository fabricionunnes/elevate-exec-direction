// Estado da conexão do Meta Ads e o botão "Atualizar agora".
//
// A conta é a do CRM (crm_meta_ads_accounts). O banco sincroniza sozinho de 2 em
// 2 horas; se passar de 8 h sem sincronizar é acesso vencido ou conexão caída,
// e aí o texto fica âmbar (mais de 8 h) ou vermelho (mais de um dia).
import { useEffect, useState } from "react";
import type { Painel } from "./tipos";
import { brl, brlFull, dataBR, num } from "./fmt";

type Meta = Painel["trafego"]["meta"];

/** "há 12 min", "há 3 h", "há 3 dias" */
export function haQuanto(iso: string | null | undefined, agora = Date.now()): string | null {
  if (!iso) return null;
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

/** g = em dia, a = mais de 8 h, r = mais de um dia ou sem conta */
export function nivelSync(meta: Meta | undefined, agora = Date.now()): "g" | "a" | "r" {
  if (!meta?.conectada || !meta.ultimo_sync) return "r";
  const h = (agora - new Date(meta.ultimo_sync).getTime()) / 3600000;
  return h > 24 ? "r" : h > 8 ? "a" : "g";
}

/** classe de cor do saldo: vermelho zerado/crítico, âmbar baixo */
export const corSaldo = (meta: Meta | undefined): string => (meta?.nivel_saldo === "zerado" || meta?.nivel_saldo === "critico" ? "neg" : meta?.nivel_saldo === "baixo" ? "warn" : "");

/** "dá pra 3 dias no ritmo de R$ 113/dia", ou o motivo de não ter o número */
export function saldoSub(meta: Meta | undefined, agora = Date.now()): string {
  if (!meta?.conectada) return "sem conta conectada";
  if (meta.saldo_erro) return `não consegui conferir: ${meta.saldo_erro}`;
  if (meta.saldo == null) return "saldo ainda não conferido";
  if (meta.pre_paga === false) return "conta pós-paga: a Meta cobra no cartão, não tem saldo pra acabar";
  const ritmo = meta.media_dia ? `no ritmo de ${brl(meta.media_dia)}/dia` : "sem média de gasto recente";
  const dias = meta.nivel_saldo === "zerado" ? "zerado, campanha ativa não entrega" : meta.dias_de_saldo != null ? `dá pra ${num(meta.dias_de_saldo)} ${meta.dias_de_saldo === 1 ? "dia" : "dias"}` : "";
  return `${[dias, ritmo].filter(Boolean).join(" ")} · conferido ${haQuanto(meta.saldo_conferido_em, agora) ?? "-"}`;
}

/** "Conta Ativa · pré-paga · Saldo disponível (R$0,00 BRL)" */
export function contaTxt(meta: Meta | undefined): string {
  if (!meta?.conectada) return "";
  return [meta.situacao ? `conta ${meta.situacao.toLowerCase()}` : null, meta.pre_paga == null ? null : meta.pre_paga ? "pré-paga" : "pós-paga", meta.forma_pagamento ? `pagamento: ${meta.forma_pagamento}` : null,
    meta.devido ? `devendo ${brlFull(meta.devido)}` : null].filter(Boolean).join(" · ");
}

/** Linha de saldo pro card clicável da visão geral. */
export function MetaSaldoTxt({ meta }: { meta: Meta | undefined }) {
  if (!meta?.conectada || meta.saldo == null || meta.pre_paga === false) return null;
  return <span className={`msync ${corSaldo(meta) === "neg" ? "r" : corSaldo(meta) === "warn" ? "a" : ""}`}>Saldo no Meta: <b>{brlFull(meta.saldo)}</b>{meta.nivel_saldo === "zerado" ? " · zerado" : meta.dias_de_saldo != null ? ` · dá pra ${num(meta.dias_de_saldo)} ${meta.dias_de_saldo === 1 ? "dia" : "dias"}` : ""}</span>;
}

/** Só o texto, pra usar dentro de card clicável (botão dentro de botão não pode). */
export function MetaStatusTxt({ meta }: { meta: Meta | undefined }) {
  const agora = useAgora();
  if (!meta?.conectada) return <span className="msync r"><span className="dot r" />Meta Ads: nenhuma conta conectada</span>;
  const n = nivelSync(meta, agora);
  return <span className={`msync ${n}`}><span className={`dot ${n}`} />Meta Ads: {meta.ultimo_sync ? `sincronizado ${haQuanto(meta.ultimo_sync, agora)}` : "nunca sincronizou"}</span>;
}

function useAgora(): number {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 60000); return () => clearInterval(t); }, []);
  return agora;
}

export function MetaSync({ meta, sincronizando, onSync, abrir, completo }: {
  meta: Meta | undefined; sincronizando: boolean; onSync: () => void; abrir: (url: string) => void; completo?: boolean;
}) {
  const agora = useAgora();
  if (!meta?.conectada) {
    return (
      <div className="msync r">
        <span><span className="dot r" />Meta Ads: nenhuma conta conectada. {completo && "Sem ela o painel fica sem investimento, CPL e ROAS. "}</span>
        <button type="button" className="back" onClick={() => abrir("/crm")}>Conectar em CRM, Tráfego Pago</button>
      </div>
    );
  }
  const n = nivelSync(meta, agora);
  return (
    <div className={`msync ${n}`}>
      <span>
        <span className={`dot ${n}`} />
        Meta Ads: {meta.ultimo_sync ? `sincronizado ${haQuanto(meta.ultimo_sync, agora)}` : "nunca sincronizou"}
        {n !== "g" && ". Acesso vencido ou conexão caída"}
        {completo && (
          <span className="nd">
            {" "}· {meta.conta ?? "-"} ({meta.ad_account_id ?? "-"}){contaTxt(meta) ? ` · ${contaTxt(meta)}` : ""}
            {meta.ultimo_dia_com_gasto ? ` · último dia com gasto ${dataBR(meta.ultimo_dia_com_gasto)}${meta.dias_sem_gasto ? ` (${meta.dias_sem_gasto} ${meta.dias_sem_gasto === 1 ? "dia" : "dias"} atrás)` : ""}` : " · nenhum gasto registrado"}
          </span>
        )}
      </span>
      <button type="button" className="back" disabled={sincronizando} onClick={onSync} title="Busca os últimos 35 dias direto na Meta. Leva uns 15 segundos.">
        {sincronizando ? "Sincronizando, uns 15 s..." : "Atualizar agora"}
      </button>
      {n !== "g" && <button type="button" className="back" onClick={() => abrir("/crm")}>Reconectar em CRM, Tráfego Pago</button>}
    </div>
  );
}
