// Dados reais pras TVs das salas de setor (views security definer no banco).
// Comercial = dashboard do CRM · Produto = clientes/health score/CS.
// Financeiro fica de fora de propósito (dados sigilosos).
// NPS e churn ficaram de fora: a base ainda não tem respostas de NPS nem
// data de saída confiável (inativações em massa na migração) — número que
// mente é pior que card ausente.
import { supabase } from '@/integrations/supabase/client'

export interface TvComercial {
  deals_abertos: number
  pipeline_valor: number
  vendas_mes: number
  receita_mes: number
  /** metas do mês (soma das metas de "Vendas" do CRM); 0 = não lançada */
  meta_mes: number
  super_meta_mes: number
  hiper_meta_mes: number
}

export interface TvProduto {
  clientes_ativos: number
  health_medio: number | null
  em_risco: number | null
  reunioes_mes: number
}

export async function fetchTvComercial(): Promise<TvComercial | null> {
  const { data } = await supabase.from('office_tv_comercial' as never).select('*').maybeSingle()
  if (!data) return null
  const d = data as unknown as Record<string, number | string | null>
  return {
    deals_abertos: Number(d.deals_abertos ?? 0),
    pipeline_valor: Number(d.pipeline_valor ?? 0),
    vendas_mes: Number(d.vendas_mes ?? 0),
    receita_mes: Number(d.receita_mes ?? 0),
    meta_mes: Number(d.meta_mes ?? 0),
    super_meta_mes: Number(d.super_meta_mes ?? 0),
    hiper_meta_mes: Number(d.hiper_meta_mes ?? 0),
  }
}

export async function fetchTvProduto(): Promise<TvProduto | null> {
  const { data } = await supabase.from('office_tv_produto' as never).select('*').maybeSingle()
  if (!data) return null
  const d = data as unknown as Record<string, number | string | null>
  return {
    clientes_ativos: Number(d.clientes_ativos ?? 0),
    health_medio: d.health_medio == null ? null : Number(d.health_medio),
    em_risco: d.em_risco == null ? null : Number(d.em_risco),
    reunioes_mes: Number(d.reunioes_mes ?? 0),
  }
}

export function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`
  return `R$ ${v.toFixed(0)}`
}
