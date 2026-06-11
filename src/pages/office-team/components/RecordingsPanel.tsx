// Painel de gravações de reunião — acesso administrativo (RLS master/admin).
// Lista, baixa o áudio e mostra a transcrição; cada gravação expira em 30 dias.
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface RecordingRow {
  id: string
  room_name: string | null
  started_by_name: string | null
  duration_s: number | null
  audio_path: string
  transcript: string | null
  created_at: string
  expires_at: string
}

function fmtDuration(s: number | null): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function RecordingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<RecordingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void supabase
      .from('office_meeting_recordings' as never)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setItems((data as unknown as RecordingRow[]) ?? [])
        setLoading(false)
      })
  }, [open])

  const download = async (rec: RecordingRow) => {
    setBusyId(rec.id)
    try {
      const { data, error } = await supabase.storage.from('office-recordings').download(rec.audio_path)
      if (error || !data) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `reuniao-${(rec.room_name ?? 'escritorio').replace(/\s+/g, '-')}-${rec.created_at.slice(0, 10)}.webm`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      // RLS nega pra não-admin / arquivo expirado
    } finally {
      setBusyId(null)
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(680px, 92vw)',
        maxHeight: '80vh',
        background: 'rgba(10, 10, 20, 0.97)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,215,0,0.3)',
        borderRadius: '16px',
        padding: '20px',
        zIndex: 125,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px' }}>🎞️ Gravações de reunião</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
            Acesso administrativo · cada gravação expira em 30 dias
          </div>
        </div>
        <button
          onClick={onClose}
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
        {loading && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>Carregando...</div>}
        {!loading && items.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '30px', textAlign: 'center' }}>
            Nenhuma gravação ainda. Use o botão ⏺ durante uma reunião.
          </div>
        )}
        {items.map((rec) => {
          const daysLeft = Math.max(0, Math.ceil((new Date(rec.expires_at).getTime() - Date.now()) / 86400000))
          return (
            <div
              key={rec.id}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>
                    {rec.room_name ?? 'Escritório'} · {fmtDuration(rec.duration_s)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                    {new Date(rec.created_at).toLocaleString('pt-BR')} · por {rec.started_by_name ?? '—'} · expira em {daysLeft}d
                  </div>
                </div>
                <button
                  onClick={() => void download(rec)}
                  disabled={busyId === rec.id}
                  style={{
                    background: '#B8860B',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 12px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: busyId === rec.id ? 'wait' : 'pointer',
                  }}
                >
                  ⬇ Baixar áudio
                </button>
                <button
                  onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                  disabled={!rec.transcript}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: '8px',
                    padding: '7px 12px',
                    color: rec.transcript ? '#eee' : 'rgba(255,255,255,0.3)',
                    fontSize: '12px',
                    cursor: rec.transcript ? 'pointer' : 'not-allowed',
                  }}
                >
                  📝 {rec.transcript ? (expandedId === rec.id ? 'Ocultar' : 'Transcrição') : 'Sem transcrição'}
                </button>
              </div>
              {expandedId === rec.id && rec.transcript && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.35)',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    lineHeight: 1.55,
                    color: 'rgba(255,255,255,0.85)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}
                >
                  {rec.transcript}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
