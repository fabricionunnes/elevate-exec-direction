// Voz com o MAX no escritório dos humanos: microfone no canto, o MAX vem até você
// (aceno sincronizado pra todo mundo ver), fala pelo balão e pelo áudio, e quando
// aciona alguém do time o robô vai pra mesa trabalhar. Mesmo cérebro da tela
// Time de IA (ai-team-chat, modo voz).
import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore } from '../store/useTeamStore'
import { fetchUnvCompanyId } from '../lib/agents'
import type { TeamRealtime } from '../lib/realtime'
import { useMaxVoice, temReconhecimento } from '@/pages/time-ia/useMaxVoice'

const RED = '#CC1B1B'
const NAVY = '#0D2B5E'

export default function MaxVoiceDock({ realtime }: { realtime: TeamRealtime }) {
  const me = useTeamStore((s) => s.me)
  const setMaxSpeech = useTeamStore((s) => s.setMaxSpeech)
  const setTeamStatus = useTeamStore((s) => s.setTeamStatus)
  const summonTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const ask = useCallback(async (msg: string): Promise<string> => {
    const companyId = await fetchUnvCompanyId()
    if (!companyId) throw new Error('empresa UNV não encontrada no Nexus')
    const { data, error } = await supabase.functions.invoke('ai-team-chat', {
      body: { companyId, message: msg, modo: 'voz', agente: 'orquestrador' },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    for (const a of (data?.actions ?? []) as Array<{ tool: string; input?: { agent_key?: string }; result?: { entrega?: string } }>) {
      if (a.tool === 'rodar_agente' && a.input?.agent_key) {
        setTeamStatus(a.input.agent_key, { working: false, lastSummary: a.result?.entrega ?? null, lastAt: Date.now() })
      }
    }
    return String(data?.reply || '')
  }, [setTeamStatus])

  const voz = useMaxVoice(ask)

  // MAX vem até mim enquanto a conversa está ativa (aceno re-enviado antes de expirar)
  const chamarMax = useCallback(() => {
    if (!me) return
    const st = useTeamStore.getState()
    const [px, , pz] = st.playerPosition
    realtime.sendAgentSummon({
      agentKey: 'ceo', x: Number(px.toFixed(2)), z: Number(pz.toFixed(2)), seat: null,
      byId: me.id, byName: me.name, floor: st.floor, allowed: true, context: 'office', ts: Date.now(),
    })
  }, [me, realtime])

  useEffect(() => {
    const ativo = voz.fase !== 'parado'
    if (ativo && !summonTimer.current) {
      chamarMax()
      summonTimer.current = setInterval(chamarMax, 45000)
    }
    if (!ativo && summonTimer.current) {
      clearInterval(summonTimer.current)
      summonTimer.current = null
    }
    return () => { if (summonTimer.current) { clearInterval(summonTimer.current); summonTimer.current = null } }
  }, [voz.fase, chamarMax])

  // o que o MAX fala vai pro balão dele; some quando ele para
  useEffect(() => {
    if (voz.fase === 'falando' && voz.falaAtual) setMaxSpeech(voz.falaAtual)
    else if (voz.fase === 'ouvindo' || voz.fase === 'parado') setMaxSpeech(null)
  }, [voz.fase, voz.falaAtual, setMaxSpeech])

  if (!me || me.isGuest) return null

  const onMic = () => {
    if (voz.fase === 'ouvindo') { voz.parar(); return }
    if (voz.fase === 'falando') { voz.parar(); voz.ouvir(); return }
    if (voz.fase === 'pensando') return
    voz.ouvir()
  }
  const legenda = {
    ouvindo: voz.parcial ? `"${voz.parcial}"` : 'Pode falar com o MAX',
    pensando: 'MAX está olhando os números…',
    falando: 'MAX falando (toque pra interromper)',
    parado: temReconhecimento ? 'Falar com o MAX' : 'Voz indisponível neste navegador',
  }[voz.fase]

  return (
    <div
      style={{
        position: 'fixed', bottom: '96px', left: '16px', zIndex: 55,
        display: 'flex', alignItems: 'center', gap: '10px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <button
        onClick={onMic}
        disabled={voz.fase === 'pensando'}
        title={legenda}
        style={{
          width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: voz.fase === 'ouvindo' ? RED : '#fff', color: voz.fase === 'ouvindo' ? '#fff' : NAVY,
          boxShadow: voz.fase === 'ouvindo' ? `0 0 0 8px ${RED}33, 0 6px 20px rgba(0,0,0,0.45)` : '0 6px 20px rgba(0,0,0,0.45)',
          fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {voz.fase === 'pensando' ? '…' : voz.fase === 'ouvindo' ? '■' : '🎙'}
      </button>
      <div style={{ maxWidth: '300px', fontSize: '12px', color: 'rgba(255,255,255,0.9)', background: 'rgba(10,10,20,0.78)', borderRadius: '10px', padding: '7px 11px', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div>{legenda}</div>
        {voz.erro && <div style={{ color: '#ffb4b4', marginTop: '2px' }}>{voz.erro}</div>}
        <button onClick={() => voz.setMaosLivres(!voz.maosLivres)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '10px', cursor: 'pointer', padding: 0, marginTop: '2px' }}>
          {voz.maosLivres ? 'mãos livres' : 'toque pra falar'}
        </button>
      </div>
    </div>
  )
}
