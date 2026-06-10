// Controles de sala: sala atual + trancar/destrancar, ir pra minha sala,
// criar novas salas (master) e personalizar avatar.
import { useState } from 'react'
import { useStaffPermissions } from '@/hooks/useStaffPermissions'
import { useTeamStore } from '../store/useTeamStore'
import { createRoom, setRoomLock, isEffectivelyLocked, RoomType } from '../lib/rooms'
import type { TeamRealtime } from '../lib/realtime'

const ROOM_COLORS = ['#CC1B1B', '#1A4A8A', '#1B6B3A', '#6B2FA0', '#B85C00', '#C2185B', '#0D2B5E', '#006B6B']

const panelStyle: React.CSSProperties = {
  background: 'rgba(10,10,20,0.85)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: '#fff',
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: '#eee',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left' as const,
}

export default function RoomControls({ realtime }: { realtime: TeamRealtime }) {
  const me = useTeamStore((s) => s.me)
  const rooms = useTeamStore((s) => s.rooms)
  const myRoomId = useTeamStore((s) => s.myRoomId)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const setPendingWalkTo = useTeamStore((s) => s.setPendingWalkTo)
  const setAvatarEditorOpen = useTeamStore((s) => s.setAvatarEditorOpen)
  const { isMaster } = useStaffPermissions()

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<RoomType>('sector')
  const [newColor, setNewColor] = useState(ROOM_COLORS[0])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!me) return null

  const currentRoom = rooms.find((r) => r.id === myRoomId) ?? null
  const onlineIds = new Set([me.id, ...Object.keys(remotePlayers)])
  const currentLocked = currentRoom ? isEffectivelyLocked(currentRoom, onlineIds) : false
  const canUnlock = currentRoom && (currentRoom.lockedBy === me.id || isMaster)
  const myPersonalRoom = rooms.find((r) => r.roomType === 'personal' && r.ownerUserId === me.id)

  const toggleLock = async () => {
    if (!currentRoom || busy) return
    setBusy(true)
    if (currentLocked) {
      if (canUnlock) await setRoomLock(currentRoom.id, false, me.id)
    } else {
      await setRoomLock(currentRoom.id, true, me.id)
    }
    realtime.announceRoomsChanged()
    setBusy(false)
  }

  const goToMyRoom = () => {
    if (myPersonalRoom) setPendingWalkTo([myPersonalRoom.x, myPersonalRoom.z])
  }

  const submitCreate = async () => {
    if (!newName.trim() || busy) return
    setBusy(true)
    setFeedback(null)
    const result = await createRoom({
      name: newName.trim(),
      type: newType,
      sector: newType === 'sector' ? newName.trim().toLowerCase() : null,
      color: newColor,
      createdBy: me.id,
      rooms,
    })
    if (result.ok) {
      realtime.announceRoomsChanged()
      setNewName('')
      setCreating(false)
      setFeedback(null)
    } else if (result.reason === 'no_slot') {
      setFeedback('Sem espaço livre para esse tipo de sala.')
    } else {
      setFeedback('Erro ao salvar a sala. Tente novamente.')
    }
    setBusy(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 95,
        width: '210px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Sala atual + trancar */}
      <div style={panelStyle}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Você está em
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '3px', color: currentRoom ? '#fff' : 'rgba(255,255,255,0.5)' }}>
          {currentRoom ? `${currentLocked ? '🔒 ' : ''}${currentRoom.name}` : 'Corredor'}
        </div>
        {currentRoom && (
          <button
            onClick={toggleLock}
            disabled={busy || (currentLocked && !canUnlock)}
            style={{
              ...btnStyle,
              marginTop: '8px',
              textAlign: 'center',
              background: currentLocked ? 'rgba(229,57,53,0.25)' : 'rgba(255,255,255,0.08)',
              borderColor: currentLocked ? 'rgba(229,57,53,0.5)' : 'rgba(255,255,255,0.18)',
              cursor: currentLocked && !canUnlock ? 'not-allowed' : 'pointer',
            }}
          >
            {currentLocked
              ? canUnlock
                ? '🔓 Destrancar sala'
                : '🔒 Trancada por outro usuário'
              : '🔒 Trancar sala'}
          </button>
        )}
      </div>

      {/* Ações */}
      <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {myPersonalRoom && (
          <button onClick={goToMyRoom} style={btnStyle} title="Atalho: tecla X">
            🚪 Ir pra minha sala (X)
          </button>
        )}
        <button onClick={() => setAvatarEditorOpen(true)} style={btnStyle}>
          🧍 Personalizar avatar
        </button>
        {isMaster && (
          <button onClick={() => setCreating((v) => !v)} style={btnStyle}>
            ➕ Nova sala
          </button>
        )}
      </div>

      {/* Form de criação (master) */}
      {creating && isMaster && (
        <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da sala / setor"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '8px',
              padding: '8px 10px',
              color: '#fff',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as RoomType)}
            style={{
              background: 'rgba(20,20,32,0.95)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '8px',
              padding: '8px 10px',
              color: '#fff',
              fontSize: '12px',
              outline: 'none',
            }}
          >
            <option value="sector">Sala de setor</option>
            <option value="meeting">Sala de reunião</option>
            <option value="personal">Sala privada</option>
            <option value="lounge">Lounge</option>
          </select>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ROOM_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: c,
                  border: newColor === c ? '2px solid #FFD700' : '1.5px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          {feedback && <div style={{ fontSize: '11px', color: '#ff8a80' }}>{feedback}</div>}
          <button
            onClick={submitCreate}
            disabled={busy || !newName.trim()}
            style={{
              ...btnStyle,
              textAlign: 'center',
              background: newName.trim() ? '#B8860B' : 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#fff',
            }}
          >
            {busy ? 'Criando...' : 'Criar sala'}
          </button>
        </div>
      )}
    </div>
  )
}
