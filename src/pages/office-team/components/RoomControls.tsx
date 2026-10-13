// Controles de sala: sala atual + trancar/destrancar, ir pra minha sala,
// criar novas salas (master), convidar visitante e personalizar avatar.
import { useState } from 'react'
import { useStaffPermissions } from '@/hooks/useStaffPermissions'
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore } from '../store/useTeamStore'
import { createRoom, setRoomLock, setRoomFloor, isEffectivelyLocked, personalOwnerSeat, RoomType } from '../lib/rooms'
import { FLOORS, floorShort } from '../lib/floors'
import RecordingsPanel from './RecordingsPanel'
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
  const rooms = useTeamStore((s) => s.rooms) // todas (pra achar a minha sala em qualquer andar)
  const roomsHere = useTeamStore((s) => s.roomsOnFloor)
  const floor = useTeamStore((s) => s.floor)
  const myRoomId = useTeamStore((s) => s.myRoomId)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const setPendingWalkTo = useTeamStore((s) => s.setPendingWalkTo)
  const setAvatarEditorOpen = useTeamStore((s) => s.setAvatarEditorOpen)
  const { isMaster } = useStaffPermissions()
  const [inviteBusy, setInviteBusy] = useState(false)

  // Link público da sala de reunião atual (cola no Google Agenda → cai dentro)
  const copyMeetingLink = async () => {
    if (!currentRoom) return
    const link = `${window.location.origin}/#/onboarding-tasks/unv-office?room=${currentRoom.id}`
    try {
      await navigator.clipboard.writeText(link)
      useTeamStore.getState().addToast('🔗 Link da reunião copiado — cole no Google Agenda', 'in')
    } catch {
      window.prompt('Copie o link da reunião:', link)
    }
  }

  // Convite de visitante: gera token de 24h e copia o link
  const inviteGuest = async () => {
    if (!me || inviteBusy) return
    setInviteBusy(true)
    const { data, error } = await supabase
      .from('office_guest_invites' as never)
      .insert({ created_by: me.id } as never)
      .select('token')
      .single()
    setInviteBusy(false)
    const token = (data as { token?: string } | null)?.token
    const st = useTeamStore.getState()
    if (error || !token) {
      st.addToast('Não consegui gerar o convite. Tenta de novo.', 'out')
      return
    }
    // O app usa HashRouter: a rota vive depois do # (sem ele cai na home)
    const link = `${window.location.origin}/#/onboarding-tasks/unv-office?invite=${token}`
    try {
      await navigator.clipboard.writeText(link)
      st.addToast('✉️ Link de visitante copiado (vale 24h) — manda pro convidado', 'in')
    } catch {
      window.prompt('Copie o link do convite (vale 24h):', link)
    }
  }

  const [creating, setCreating] = useState(false)
  const [recordingsOpen, setRecordingsOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<RoomType>('sector')
  const [newColor, setNewColor] = useState(ROOM_COLORS[0])
  // Andar da sala nova: null = o andar em que estou agora
  const [newFloor, setNewFloor] = useState<number | null>(null)
  const [moving, setMoving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!me) return null

  const currentRoom = roomsHere.find((r) => r.id === myRoomId) ?? null
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

  const setPendingSeat = useTeamStore((s) => s.setPendingSeat)

  const goToMyRoom = () => {
    if (myPersonalRoom) {
      // Vai até a sala E senta na própria cadeira (troca de andar se precisar)
      const seat = personalOwnerSeat(myPersonalRoom)
      setPendingWalkTo({ x: seat.x, z: seat.z, teleportFallback: true, floor: myPersonalRoom.floor })
      setPendingSeat(seat)
    }
  }

  // Master: move a sala em que estou pra outro andar (mesmo slot na planta)
  const moveRoomToFloor = async (target: number) => {
    if (!currentRoom || busy || target === currentRoom.floor) return
    setBusy(true)
    const ok = await setRoomFloor(currentRoom.id, target)
    setBusy(false)
    setMoving(false)
    const st = useTeamStore.getState()
    if (ok) {
      realtime.announceRoomsChanged()
      st.addToast(`Sala "${currentRoom.name}" movida pro ${floorShort(target)}`, 'in')
    } else {
      st.addToast('Não consegui mover a sala. Tenta de novo.', 'out')
    }
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
      floor: newFloor ?? floor,
    })
    if (result.ok) {
      realtime.announceRoomsChanged()
      setNewName('')
      setCreating(false)
      setFeedback(null)
    } else if (result.ok === false && result.reason === 'no_slot') {
      setFeedback('Sem espaço livre para esse tipo de sala nesse andar.')
    } else {
      setFeedback('Erro ao salvar a sala. Tente novamente.')
    }
    setBusy(false)
  }

  return (
    <div
      className="office-fade-panel"
      style={{
        position: 'fixed',
        // Coluna esquerda, abaixo do painel da equipe (que tem altura limitada)
        top: 'calc(32vh + 150px)',
        left: '16px',
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
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{floorShort(floor)}</div>
        {currentRoom && currentRoom.roomType !== 'lounge' && (
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
                ? '🔓 Destrancar sala (Z)'
                : '🔒 Trancada por outro usuário'
              : '🔒 Trancar sala (Z)'}
          </button>
        )}
        {currentRoom && isMaster && !moving && (
          <button onClick={() => setMoving(true)} disabled={busy} style={{ ...btnStyle, marginTop: '6px', textAlign: 'center' }}>
            🏢 Mover pra outro andar
          </button>
        )}
        {currentRoom && isMaster && moving && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <select
              defaultValue={currentRoom.floor}
              onChange={(e) => void moveRoomToFloor(Number(e.target.value))}
              disabled={busy}
              style={{
                flex: 1,
                background: 'rgba(20,20,32,0.95)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
              }}
            >
              {FLOORS.map((f) => (
                <option key={f.n} value={f.n}>
                  {floorShort(f.n)}
                </option>
              ))}
            </select>
            <button onClick={() => setMoving(false)} style={{ ...btnStyle, width: 'auto', padding: '6px 8px' }}>
              ✕
            </button>
          </div>
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
        {isMaster && (
          <button onClick={() => setRecordingsOpen(true)} style={btnStyle}>
            🎞️ Gravações
          </button>
        )}
        {(currentRoom?.roomType === 'meeting' || currentRoom?.roomType === 'sector') && (
          <button
            onClick={() => void copyMeetingLink()}
            style={btnStyle}
            title="Copia o link desta sala — cole no Google Agenda; ao clicar, a pessoa entra direto aqui"
          >
            🔗 Copiar link da sala
          </button>
        )}
        {isMaster && (
          <button
            onClick={() => void inviteGuest()}
            style={btnStyle}
            title="Gera um link de 24h pra um convidado entrar direto na Reunião Principal"
          >
            {inviteBusy ? '⏳ Gerando link...' : '✉️ Convidar visitante'}
          </button>
        )}
      </div>

      <RecordingsPanel open={recordingsOpen} onClose={() => setRecordingsOpen(false)} />

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
          <select
            value={newFloor ?? floor}
            onChange={(e) => setNewFloor(Number(e.target.value))}
            title="Andar da sala nova (padrão: o andar em que você está)"
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
            {FLOORS.map((f) => (
              <option key={f.n} value={f.n}>
                {floorShort(f.n)}
              </option>
            ))}
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
