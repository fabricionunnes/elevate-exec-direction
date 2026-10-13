// HUD do auditório (fase 2 do prédio): aparece só pra quem está DENTRO do
// Auditório UNV. Mostra "Auditório · N na plateia · palestrante: nome", o
// botão Subir ao palco / Voltar pra plateia (teleporte dentro da sala) e,
// pra quem está no palco, a lista de mãos levantadas com o botão "Chamar"
// (broadcast 'stage-call': liga o microfone da pessoa e avisa "Você tem a
// palavra"). Visitante também vê (pode levantar a mão e ser chamado).
import { useEffect, useState } from 'react'
import { useTeamStore, playerFloor } from '../store/useTeamStore'
import { roomAt, stageAt, auditoriumLayout, OfficeRoom } from '../lib/rooms'
import type { TeamRealtime } from '../lib/realtime'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export default function AuditoriumPanel({ realtime }: { realtime: TeamRealtime }) {
  const me = useTeamStore((s) => s.me)
  const myRoomId = useTeamStore((s) => s.myRoomId)
  const rooms = useTeamStore((s) => s.roomsOnFloor)
  const floor = useTeamStore((s) => s.floor)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const room: OfficeRoom | null = myRoomId ? rooms.find((r) => r.id === myRoomId) ?? null : null
  const inAuditorium = !!room && room.roomType === 'auditorium'

  // Minha zona (palco/plateia) muda com a posição: poll leve de 300ms
  const [onStage, setOnStage] = useState(false)
  useEffect(() => {
    if (!inAuditorium) return
    const tick = () => {
      const st = useTeamStore.getState()
      const [px, , pz] = st.playerPosition
      setOnStage(!!stageAt(px, pz, st.roomsOnFloor))
    }
    tick()
    const iv = setInterval(tick, 300)
    return () => clearInterval(iv)
  }, [inAuditorium])

  if (!me || !room || !inAuditorium) return null

  const layout = auditoriumLayout(room)
  const inside = Object.values(remotePlayers).filter(
    (p) => playerFloor(p) === floor && roomAt(p.position[0], p.position[2], rooms)?.id === room.id
  )
  const speakers = inside.filter((p) => stageAt(p.position[0], p.position[2], rooms))
  const audience = inside.filter((p) => !stageAt(p.position[0], p.position[2], rooms))
  const audienceCount = audience.length + (onStage ? 0 : 1)
  const speakerNames = [...(onStage ? [`${me.name.split(' ')[0]} (você)`] : []), ...speakers.map((p) => p.name.split(' ')[0])]
  const hands = audience.filter((p) => p.handRaised)

  const goStage = () => {
    const st = useTeamStore.getState()
    st.setPendingSeat(null)
    st.setPendingWalkTo(null)
    st.setPendingTeleport({ x: layout.stageSpot.x, z: layout.stageSpot.z, floor: room.floor })
  }
  const goAudience = () => {
    const st = useTeamStore.getState()
    st.setPendingSeat(null)
    st.setPendingWalkTo(null)
    st.setPendingTeleport({ x: layout.audienceSpot.x, z: layout.audienceSpot.z, floor: room.floor })
  }
  const callToSpeak = (id: string, name: string) => {
    realtime.sendStageCall(id)
    useTeamStore.getState().addToast(`🎤 Você deu a palavra pra ${name.split(' ')[0]}`, 'in')
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 96,
        width: '250px',
        background: 'rgba(10,10,20,0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,215,0,0.4)',
        borderRadius: '12px',
        padding: '10px 12px',
        color: '#fff',
        fontFamily: font,
        boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,215,0,0.8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Auditório
      </div>
      <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '3px' }}>
        {room.name} · {audienceCount} na plateia
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
        palestrante: {speakerNames.length ? speakerNames.join(', ') : 'ninguém no palco'}
      </div>
      <button
        onClick={onStage ? goAudience : goStage}
        style={{
          marginTop: '8px',
          width: '100%',
          padding: '8px 10px',
          borderRadius: '8px',
          border: '1px solid rgba(255,215,0,0.5)',
          background: onStage ? 'rgba(255,255,255,0.08)' : '#0D2B5E',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: font,
        }}
      >
        {onStage ? '🪑 Voltar pra plateia' : '🎤 Subir ao palco'}
      </button>
      {!onStage && (
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '6px' }}>
          Na plateia o microfone fica fechado: só o vizinho do lado e o palco te ouvem. Levante a mão (✋) pra pedir a
          palavra.
        </div>
      )}
      {onStage && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Mãos levantadas · {hands.length}
          </div>
          {hands.length === 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Ninguém pediu a palavra ainda.</div>
          )}
          {hands.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '14px' }}>✋</span>
              <span style={{ flex: 1, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              <button
                onClick={() => callToSpeak(p.id, p.name)}
                style={{
                  background: '#CC1B1B',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '4px 9px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: font,
                }}
              >
                Chamar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
