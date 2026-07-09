// Notificações pequenas no canto: fulano entrou/saiu do escritório.
import { useEffect } from 'react'
import { useTeamStore } from '../store/useTeamStore'

function Toast({ id, text, kind }: { id: string; text: string; kind: 'in' | 'out' }) {
  const removeToast = useTeamStore((s) => s.removeToast)

  useEffect(() => {
    const t = setTimeout(() => removeToast(id), 5000)
    return () => clearTimeout(t)
  }, [id, removeToast])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(10,10,20,0.92)',
        border: `1px solid ${kind === 'in' ? 'rgba(76,175,80,0.45)' : 'rgba(255,255,255,0.18)'}`,
        borderRadius: '10px',
        padding: '8px 14px',
        color: '#eee',
        fontSize: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        animation: 'office-toast-in 0.25s ease-out',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: kind === 'in' ? '#4CAF50' : '#9aa3ad',
          boxShadow: kind === 'in' ? '0 0 6px #4CAF50' : 'none',
          flexShrink: 0,
        }}
      />
      {text}
    </div>
  )
}

export default function OfficeToasts() {
  const toasts = useTeamStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '84px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 96,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <style>{`
        @keyframes office-toast-in {
          from { transform: translateX(30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      {toasts.map((t) => (
        <Toast key={t.id} id={t.id} text={t.text} kind={t.kind} />
      ))}
    </div>
  )
}
