// Voz com o Max dentro do escritório 3D: microfone no rodapé, o Max fala pelo
// balão sobre a cabeça dele (e pelo áudio), e quando ele aciona alguém do time o
// personagem vai pra mesa e entra em "trabalhando". Mesmo cérebro da tela Time de IA
// (ai-team-chat, modo voz).
import { useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store/useGameStore'
import { AGENTS, agentByTeamKey } from '../config/agents'
import { useMaxVoice, temReconhecimento } from '@/pages/time-ia/useMaxVoice'

const RED = '#CC1B1B'
const NAVY = '#0D2B5E'

export default function OfficeVoice() {
  const { teamCompanyId, setTeamSpeech, setTeamStatus, setAgentState } = useGameStore()
  const max = AGENTS.find((a) => a.id === 'max')!

  const ask = useCallback(async (msg: string): Promise<string> => {
    if (!teamCompanyId) throw new Error('Time de IA da UNV não encontrado')
    const { data, error } = await supabase.functions.invoke('ai-team-chat', {
      body: { companyId: teamCompanyId, message: msg, modo: 'voz', agente: 'orquestrador' },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    // quem o Max acionou vai pra mesa trabalhar
    for (const a of data?.actions || []) {
      if (a.tool === 'rodar_agente' && a.input?.agent_key) {
        const ag = agentByTeamKey(a.input.agent_key)
        if (ag) {
          setTeamStatus(ag.id, { working: false, lastSummary: a.result?.entrega || null, lastAt: Date.now() })
          setAgentState(ag.id, { state: 'WORKING', targetPosition: ag.homePosition })
          if (a.result?.entrega) setTeamSpeech({ agent: ag.id, content: String(a.result.entrega) })
        }
      }
    }
    return String(data?.reply || '')
  }, [teamCompanyId, setTeamStatus, setAgentState, setTeamSpeech])

  const voz = useMaxVoice(ask)

  // o que o Max fala aparece no balão dele; quando para de falar, o balão some
  useEffect(() => {
    if (voz.fase === 'falando' && voz.falaAtual) setTeamSpeech({ agent: max.id, content: voz.falaAtual })
    else if (voz.fase === 'ouvindo' || voz.fase === 'parado') {
      const cur = useGameStore.getState().teamSpeech
      if (cur?.agent === max.id) setTeamSpeech(null)
    }
  }, [voz.fase, voz.falaAtual, max.id, setTeamSpeech])

  // Max se vira pra conversa: fica parado na mesa enquanto você fala com ele
  useEffect(() => {
    if (voz.fase !== 'parado') setAgentState(max.id, { state: 'IDLE', targetPosition: null })
  }, [voz.fase, max.id, setAgentState])

  const onMic = () => {
    if (voz.fase === 'ouvindo') { voz.parar(); return }
    if (voz.fase === 'falando') { voz.parar(); voz.ouvir(); return }
    if (voz.fase === 'pensando') return
    voz.ouvir()
  }

  const legenda = { ouvindo: voz.parcial ? `"${voz.parcial}"` : 'Pode falar com o Max', pensando: 'Max está olhando os números…', falando: 'Max falando (toque pra interromper)', parado: temReconhecimento ? 'Falar com o Max' : 'Voz indisponível neste navegador' }[voz.fase]

  return (
    <div
      style={{
        position: 'fixed', bottom: '18px', left: '50%', transform: 'translateX(-50%)', zIndex: 60,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: '420px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.85)', background: 'rgba(10,10,20,0.75)', borderRadius: '10px', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.12)' }}>
        {legenda}
        {voz.erro && <div style={{ color: '#ffb4b4', marginTop: '2px' }}>{voz.erro}</div>}
      </div>
      <button
        onClick={onMic}
        disabled={voz.fase === 'pensando'}
        title={legenda}
        style={{
          width: '64px', height: '64px', borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: voz.fase === 'ouvindo' ? RED : '#fff', color: voz.fase === 'ouvindo' ? '#fff' : NAVY,
          boxShadow: voz.fase === 'ouvindo' ? `0 0 0 10px ${RED}33, 0 8px 24px rgba(0,0,0,0.5)` : '0 8px 24px rgba(0,0,0,0.5)',
          fontSize: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform .1s', transform: voz.fase === 'falando' ? 'scale(1.06)' : 'scale(1)',
        }}
      >
        {voz.fase === 'pensando' ? '…' : voz.fase === 'ouvindo' ? '■' : '🎙'}
      </button>
      <button
        onClick={() => voz.setMaosLivres(!voz.maosLivres)}
        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '11px', cursor: 'pointer' }}
      >
        {voz.maosLivres ? 'mãos livres' : 'toque pra falar'}
      </button>
    </div>
  )
}
