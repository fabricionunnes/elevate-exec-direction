// Festa de venda ganha: o trigger do CRM avisa o escritório (broadcast 'sale'),
// aqui toca o sino, chove confete e mostra o banner pra todo mundo.
import { useEffect, useMemo } from 'react'
import { useTeamStore } from '../store/useTeamStore'
import { playSaleBell } from '../lib/sfx'

const DURATION_MS = 8000
const COLORS = ['#FFD700', '#CC1B1B', '#0D2B5E', '#4CAF50', '#FF8A65', '#81D4FA']

export default function SaleCelebration() {
  const sale = useTeamStore((s) => s.saleEvent)
  const setSale = useTeamStore((s) => s.setSaleEvent)

  useEffect(() => {
    if (!sale) return
    playSaleBell()
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('🔔 Venda fechada!', {
          body: `${sale.lead}${sale.by ? ` — por ${sale.by}` : ''}`,
        })
      }
    } catch { /* sem notificação de sistema */ }
    const timer = setTimeout(() => setSale(null), DURATION_MS)
    return () => clearTimeout(timer)
  }, [sale, setSale])

  // Confete pré-computado por evento (estável durante a animação)
  const confetti = useMemo(() => {
    if (!sale) return []
    return Array.from({ length: 90 }, (_, i) => ({
      left: (i * 37 + (sale.ts % 50)) % 100,
      delay: ((i * 13) % 30) / 10,
      dur: 2.6 + ((i * 7) % 20) / 10,
      color: COLORS[i % COLORS.length],
      size: 7 + ((i * 11) % 8),
      tilt: (i * 47) % 360,
    }))
  }, [sale])

  if (!sale) return null

  const valueLabel =
    sale.value > 0
      ? sale.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
      : null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 120, overflow: 'hidden' }}>
      <style>{`
        @keyframes sale-fall {
          0% { transform: translateY(-6vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(106vh) rotate(720deg); opacity: 0.7; }
        }
        @keyframes sale-pop {
          0% { transform: translateX(-50%) scale(0.6); opacity: 0; }
          12% { transform: translateX(-50%) scale(1.06); opacity: 1; }
          18% { transform: translateX(-50%) scale(1); }
          85% { transform: translateX(-50%) scale(1); opacity: 1; }
          100% { transform: translateX(-50%) scale(0.95); opacity: 0; }
        }
        @keyframes sale-swing {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(18deg); }
        }
      `}</style>

      {confetti.map((c, i) => (
        <div
          key={`${sale.ts}-${i}`}
          style={{
            position: 'absolute',
            top: 0,
            left: `${c.left}%`,
            width: `${c.size}px`,
            height: `${c.size * 0.45}px`,
            background: c.color,
            transform: `rotate(${c.tilt}deg)`,
            animation: `sale-fall ${c.dur}s linear ${c.delay}s both`,
            borderRadius: '2px',
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          top: '14%',
          left: '50%',
          animation: `sale-pop ${DURATION_MS / 1000}s ease both`,
          background: 'linear-gradient(135deg, rgba(13,43,94,0.97) 0%, rgba(10,16,32,0.97) 100%)',
          border: '2px solid #FFD700',
          borderRadius: '18px',
          padding: '20px 34px',
          textAlign: 'center',
          color: '#fff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          boxShadow: '0 16px 60px rgba(0,0,0,0.55), 0 0 40px rgba(255,215,0,0.25)',
          minWidth: '300px',
        }}
      >
        <div style={{ fontSize: '40px', display: 'inline-block', animation: 'sale-swing 0.7s ease-in-out 4' }}>🔔</div>
        <div style={{ fontSize: '21px', fontWeight: 900, color: '#FFD700', letterSpacing: '1px', marginTop: '4px' }}>
          VENDA FECHADA!
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '8px' }}>{sale.lead}</div>
        {valueLabel && (
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#4CAF50', marginTop: '4px' }}>{valueLabel}</div>
        )}
        {sale.by && (
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', marginTop: '6px' }}>
            por <strong style={{ color: '#fff' }}>{sale.by}</strong>
          </div>
        )}
      </div>
    </div>
  )
}
