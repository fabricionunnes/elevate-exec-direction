// Liga o escritório 3D ao Time de IA de verdade: acha a UNV, lê as rodadas
// (ai_team_runs) e a fila (ai_team_approvals) de 8 em 8 s e reflete nos personagens:
// rodada em andamento → vai pra mesa e "trabalhando…"; entrega recente → balão com o
// resumo por alguns segundos; itens pendentes → etiqueta "N pra aprovar".
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store/useGameStore'
import { AGENTS, agentByTeamKey } from '../config/agents'

const UNV_CNPJ = '51356237000140'
const db = supabase as any

export default function TeamSync() {
  const { setTeamCompanyId, setTeamStatus, setAgentState, setTeamSpeech } = useGameStore()
  const seenRuns = useRef<Set<string>>(new Set())
  const firstLoad = useRef(true)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    ;(async () => {
      const { data: empresa } = await supabase.from('onboarding_companies').select('id').eq('cnpj', UNV_CNPJ).maybeSingle()
      if (cancelled || !empresa?.id) return
      const companyId = empresa.id as string
      setTeamCompanyId(companyId)

      const tick = async () => {
        const [runsR, apR] = await Promise.all([
          db.from('ai_team_runs').select('id, agent_key, status, summary, started_at, finished_at')
            .eq('company_id', companyId).order('started_at', { ascending: false }).limit(30),
          db.from('ai_team_approvals').select('agent_key').eq('company_id', companyId).eq('status', 'pending'),
        ])
        if (cancelled) return
        const runs = (runsR.data || []) as { id: string; agent_key: string; status: string; summary: string | null; started_at: string; finished_at: string | null }[]
        const pend: Record<string, number> = {}
        for (const a of (apR.data || []) as { agent_key: string }[]) pend[a.agent_key] = (pend[a.agent_key] || 0) + 1

        for (const agent of AGENTS) {
          const mine = runs.filter((r) => r.agent_key === agent.teamKey)
          const running = mine.some((r) => r.status === 'running' && Date.now() - new Date(r.started_at).getTime() < 5 * 60 * 1000)
          const last = mine.find((r) => r.status === 'done')
          const wasWorking = useGameStore.getState().teamStatus[agent.id]?.working
          setTeamStatus(agent.id, {
            working: running,
            lastSummary: last?.summary || null,
            lastAt: last ? new Date(last.finished_at || last.started_at).getTime() : null,
            pending: pend[agent.teamKey] || 0,
          })
          if (running && !wasWorking) {
            // vai pra mesa e senta pra trabalhar
            setAgentState(agent.id, { state: 'WORKING', targetPosition: agent.homePosition })
          }
          if (!running && wasWorking) {
            setAgentState(agent.id, { state: 'IDLE', targetPosition: null, stateTimer: 0, nextStateChange: 10 + Math.random() * 15 })
          }
          // entrega nova (não vista nesta sessão) → balão por uns segundos
          if (last && !seenRuns.current.has(last.id)) {
            seenRuns.current.add(last.id)
            if (!firstLoad.current && last.summary) {
              setTeamSpeech({ agent: agent.id, content: last.summary })
              setTimeout(() => {
                const cur = useGameStore.getState().teamSpeech
                if (cur?.agent === agent.id && cur.content === last.summary) setTeamSpeech(null)
              }, 12000)
            }
          }
        }
        firstLoad.current = false
      }

      await tick()
      timer = setInterval(tick, 8000)
    })()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [setTeamCompanyId, setTeamStatus, setAgentState, setTeamSpeech])

  return null
}

export { agentByTeamKey }
