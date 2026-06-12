// Dados reais pras TVs das salas de setor (views security definer no banco).
// Comercial = dashboard do CRM · Produto = clientes/NPS/churn.
// Financeiro fica de fora de propósito (dados sigilosos).
import { supabase } from '@/integrations/supabase/client'

export interface TvComercial {
  deals_abertos: number
  pipeline_valor: number
  vendas_mes: number
  receita_mes: number
}

export interface TvProduto {
  clientes_ativos: number
  nps_90d: number | null
  novos_30d: number
  saidas_mes: number
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
  }
}

export async function fetchTvProduto(): Promise<TvProduto | null> {
  const { data } = await supabase.from('office_tv_produto' as never).select('*').maybeSingle()
  if (!data) return null
  const d = data as unknown as Record<string, number | string | null>
  return {
    clientes_ativos: Number(d.clientes_ativos ?? 0),
    nps_90d: d.nps_90d == null ? null : Number(d.nps_90d),
    novos_30d: Number(d.novos_30d ?? 0),
    saidas_mes: Number(d.saidas_mes ?? 0),
  }
}

export function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`
  return `R$ ${v.toFixed(0)}`
}
