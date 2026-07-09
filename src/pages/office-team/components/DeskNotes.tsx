// Recados na mesa: compor (texto/áudio) ao clicar na mesa de alguém,
// inbox de recados recebidos e banner persistente até ler tudo.
import { useEffect, useRef, useState } from 'react'
import { useTeamStore, DeskNote } from '../store/useTeamStore'
import { sendTextNote, sendAudioNote, markNoteRead, noteAudioUrl } from '../lib/notes'
import type { TeamRealtime } from '../lib/realtime'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const panelBase: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(420px, 92vw)',
  background: 'rgba(10, 10, 20, 0.97)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,215,0,0.3)',
  borderRadius: '16px',
  padding: '18px',
  zIndex: 126,
  fontFamily: font,
  color: '#fff',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
}

/** Painel de composição: texto ou áudio pra mesa de alguém. */
function ComposeNote({ realtime }: { realtime: TeamRealtime }) {
  const target = useTeamStore((s) => s.composeNoteFor)
  const setTarget = useTeamStore((s) => s.setComposeNoteFor)
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    if (!target && recorderRef.current?.state === 'recording') recorderRef.current.stop()
    setText('')
    setRecording(false)
  }, [target])

  if (!target) return null

  const finish = (ok: boolean) => {
    const st = useTeamStore.getState()
    if (ok) {
      realtime.announceNote(target.userId)
      st.addToast(`Recado deixado na mesa de ${target.name}`, 'in')
    } else {
      st.addToast('Falha ao enviar o recado', 'out')
    }
    setBusy(false)
    setTarget(null)
  }

  const sendText = async () => {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    finish(await sendTextNote(target.userId, t))
  }

  const toggleAudio = async () => {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      rec.onstop = () => {
        setRecording(false)
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: mime })
        if (blob.size < 1500) return
        setBusy(true)
        void sendAudioNote(target.userId, blob).then(finish)
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
      setTimeout(() => {
        if (rec.state === 'recording') rec.stop()
      }, 60_000)
    } catch {
      useTeamStore.getState().addToast('Permita o microfone pra gravar o recado', 'out')
    }
  }

  return (
    <div style={panelBase}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontWeight: 800, fontSize: '15px' }}>📨 Recado pra {target.name}</div>
        <button
          onClick={() => setTarget(null)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#888',
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', marginBottom: '12px' }}>
        Fica na mesa até a pessoa ler — ela é notificada quando entrar.
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreve o recado..."
        rows={4}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '10px',
          padding: '10px 12px',
          color: '#fff',
          fontSize: '13px',
          fontFamily: font,
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={() => void sendText()}
          disabled={busy || !text.trim()}
          style={{
            flex: 1,
            background: text.trim() ? '#B8860B' : 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '10px',
            padding: '10px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '13px',
            cursor: busy || !text.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Enviar texto
        </button>
        <button
          onClick={() => void toggleAudio()}
          disabled={busy}
          style={{
            flex: 1,
            background: recording ? '#c62828' : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            padding: '10px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '13px',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {recording ? '⏹ Parar e enviar' : '🎙️ Gravar áudio'}
        </button>
      </div>
    </div>
  )
}

function NoteItem({ note }: { note: DeskNote }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loadingAudio, setLoadingAudio] = useState(false)

  const loadAudio = async () => {
    if (audioUrl || !note.audio_path) return
    setLoadingAudio(true)
    setAudioUrl(await noteAudioUrl(note.audio_path))
    setLoadingAudio(false)
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '11px 13px',
      }}
    >
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
        {note.from_name ?? 'Alguém'} · {new Date(note.created_at).toLocaleString('pt-BR')}
      </div>
      {note.kind === 'text' ? (
        <div style={{ fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{note.content}</div>
      ) : audioUrl ? (
        <audio controls src={audioUrl} style={{ width: '100%', height: '36px' }} />
      ) : (
        <button
          onClick={() => void loadAudio()}
          disabled={loadingAudio}
          style={{
            background: 'rgba(127,212,255,0.15)',
            border: '1px solid rgba(127,212,255,0.4)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: '#7fd4ff',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {loadingAudio ? 'Carregando...' : '▶ Ouvir recado de voz'}
        </button>
      )}
      <button
        onClick={() => void markNoteRead(note.id)}
        style={{
          marginTop: '8px',
          background: 'rgba(76,175,80,0.18)',
          border: '1px solid rgba(76,175,80,0.45)',
          borderRadius: '8px',
          padding: '6px 12px',
          color: '#7fdc8a',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ✓ Marcar como lido
      </button>
    </div>
  )
}

export default function DeskNotes({ realtime }: { realtime: TeamRealtime }) {
  const unread = useTeamStore((s) => s.unreadNotes)
  const panelOpen = useTeamStore((s) => s.notesPanelOpen)
  const setPanelOpen = useTeamStore((s) => s.setNotesPanelOpen)

  return (
    <>
      <ComposeNote realtime={realtime} />

      {/* Banner persistente: insiste até ler tudo */}
      {unread.length > 0 && !panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          style={{
            position: 'fixed',
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(184, 134, 11, 0.95)',
            border: '1px solid rgba(255,215,0,0.6)',
            borderRadius: '999px',
            padding: '9px 20px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 800,
            zIndex: 117,
            cursor: 'pointer',
            fontFamily: font,
            boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
            animation: 'note-pulse 1.6s infinite',
          }}
        >
          <style>{`@keyframes note-pulse { 0%,100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.045); } }`}</style>
          📨 Você tem {unread.length} recado{unread.length > 1 ? 's' : ''} na sua mesa — clique pra ler
        </button>
      )}

      {/* Inbox */}
      {panelOpen && (
        <div style={{ ...panelBase, width: 'min(480px, 92vw)', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontWeight: 800, fontSize: '15px' }}>📨 Recados na sua mesa</div>
            <button
              onClick={() => setPanelOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#888',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {unread.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '24px', textAlign: 'center' }}>
                Tudo lido. 👌
              </div>
            )}
            {unread.map((n) => (
              <NoteItem key={n.id} note={n} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
