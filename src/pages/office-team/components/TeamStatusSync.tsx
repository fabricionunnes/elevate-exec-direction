// Liga o escritório dos humanos ao Time de IA de verdade: lê as rodadas
// (ai_team_runs) e a fila (ai_team_approvals) da UNV a cada 8 s e grava no store;
// o AgentNpc usa isso pra sentar na mesa "trabalhando…" e mostrar a entrega.
import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore } from '../store/useTeamStore'
import { OFFICE_AGENTS, fetchUnvCompanyId } from '../lib/agents'

const db = supabase as any

export default function TeamStatusSync() {
  const setTeamStatus = useTeamStore((s) => s.setTeamStatus)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false
    ;(async () => {
      const companyId = await fetchUnvCompanyId()
      if (!companyId || cancelled) return
      const tick = async () => {
        const [runsR, apR] = await Promise.all([
          db.from('ai_team_runs').select('agent_key, status, summary, started_at, finished_at')
            .eq('company_id', companyId).order('started_at', { ascending: false }).limit(30),
          db.from('ai_team_approvals').select('agent_key').eq('company_id', companyId).eq('status', 'pending'),
        ])
        if (cancelled) return
        const runs = (runsR.data || []) as { agent_key: string; status: string; summary: string | null; started_at: string; finished_at: string | null }[]
        const pend: Record<string, number> = {}
        for (const a of (apR.data || []) as { agent_key: string }[]) pend[a.agent_key] = (pend[a.agent_key] || 0) + 1
        for (const agent of OFFICE_AGENTS) {
          const mine = runs.filter((r) => r.agent_key === agent.teamKey)
          const running = mine.some((r) => r.status === 'running' && Date.now() - new Date(r.started_at).getTime() < 5 * 60 * 1000)
          const last = mine.find((r) => r.status === 'done')
          const prev = useTeamStore.getState().teamStatus[agent.teamKey]
          const lastAt = last ? new Date(last.finished_at || last.started_at).getTime() : null
          // só "anuncia" entrega nova quando ela aconteceu depois da última vista (evita balão ao abrir)
          const lastSeen = prev?.lastAt ?? Date.now()
          setTeamStatus(agent.teamKey, {
            working: running,
            lastSummary: last?.summary || null,
            lastAt: lastAt && lastAt > lastSeen ? lastAt : prev?.lastAt ?? (lastAt ? Math.min(lastAt, Date.now() - 60000) : null),
            pending: pend[agent.teamKey] || 0,
          })
        }
      }
      await tick()
      timer = setInterval(tick, 8000)
    })()
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [setTeamStatus])

  return null
}
