// Painel "Andares" do elevador: lista os andares com quem está em cada um
// (pelo presence). Escolher um andar inicia a viagem (fade + teleporte pra
// frente do elevador no andar novo). Visitante não tem acesso.
import { useEffect } from 'react'
import { useTeamStore, playerFloor } from '../store/useTeamStore'
import { FLOORS } from '../lib/floors'
import { requestFloor } from '../lib/floorTravel'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

/** Prédio em corte (SVG): 6 andares empilhados, térreo com a entrada,
 * cobertura no topo, andar atual aceso, um ponto por pessoa em cada andar e
 * o elevador desenhado no andar atual. `mini` = versão da pílula do HUD. */
export function BuildingCut({
  floor,
  counts,
  mini = false,
  onPick,
}: {
  floor: number
  counts?: Map<number, number>
  mini?: boolean
  onPick?: (n: number) => void
}) {
  const n = FLOORS.length
  const fh = mini ? 5 : 30 // altura de cada andar
  const w = mini ? 18 : 120
  const pad = mini ? 1 : 6
  const roofH = mini ? 3 : 14
  const totalH = n * fh + roofH + pad * 2
  const top = (i: number) => pad + roofH + (n - 1 - i) * fh
  const floors = [...FLOORS].sort((a, b) => a.n - b.n)
  return (
    <svg width={w + pad * 2} height={totalH} viewBox={`0 0 ${w + pad * 2} ${totalH}`} style={{ display: 'block', flexShrink: 0 }}>
      {/* Cobertura: platibanda + letreiro */}
      <rect x={pad} y={pad + roofH - (mini ? 1 : 4)} width={w} height={mini ? 1 : 4} fill="#cfcac0" />
      {!mini && (
        <>
          <rect x={pad + w / 2 - 16} y={pad} width={32} height={9} rx={1.5} fill="#0D2B5E" />
          <text x={pad + w / 2} y={pad + 7} textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff" fontFamily={font}>
            UNV
          </text>
        </>
      )}
      {floors.map((f) => {
        const here = f.n === floor
        const y = top(f.n)
        const c = counts?.get(f.n) ?? 0
        return (
          <g key={f.n} onClick={onPick && !here ? () => onPick(f.n) : undefined} style={{ cursor: onPick && !here ? 'pointer' : 'default' }}>
            <rect
              x={pad}
              y={y}
              width={w}
              height={fh}
              fill={here ? 'rgba(255,215,0,0.28)' : f.n === 0 ? 'rgba(13,43,94,0.9)' : 'rgba(255,255,255,0.07)'}
              stroke={here ? '#FFD700' : 'rgba(255,255,255,0.25)'}
              strokeWidth={mini ? 0.6 : 1}
            />
            {/* Fita de janela do andar */}
            {!mini && f.n > 0 && <rect x={pad + 4} y={y + 9} width={w - 8} height={9} fill={here ? 'rgba(255,230,140,0.9)' : 'rgba(170,204,238,0.45)'} />}
            {/* Térreo: entrada + faixa vermelha */}
            {f.n === 0 && !mini && (
              <>
                <rect x={pad + w / 2 - 7} y={y + fh - 16} width={14} height={16} fill="rgba(170,204,238,0.8)" />
                <rect x={pad} y={y + fh - 3} width={w} height={2} fill="#CC1B1B" />
              </>
            )}
            {/* Elevador: caixa no andar atual, no eixo central */}
            {here && (
              <rect x={pad + w / 2 - (mini ? 2 : 6)} y={y + (mini ? 1 : 4)} width={mini ? 4 : 12} height={fh - (mini ? 2 : 8)} rx={mini ? 0.5 : 2} fill="#FFD700" />
            )}
            {!mini && (
              <text x={pad + 6} y={y + fh - 8} fontSize="9" fontWeight="800" fill={here ? '#FFD700' : 'rgba(255,255,255,0.7)'} fontFamily={font}>
                {f.n === 0 ? 'T' : f.n}
              </text>
            )}
            {/* Um ponto por pessoa */}
            {Array.from({ length: Math.min(c, mini ? 3 : 8) }, (_, k) => (
              <circle
                key={k}
                cx={mini ? pad + w - 2 - k * 2.4 : pad + w - 8 - k * 9}
                cy={mini ? y + fh / 2 : y + fh - 10}
                r={mini ? 0.9 : 3}
                fill="#4CAF50"
              />
            ))}
          </g>
        )
      })}
      {/* Poço do elevador (linha discreta atravessando os andares) */}
      <rect x={pad + w / 2 - (mini ? 2 : 6)} y={top(n - 1)} width={mini ? 4 : 12} height={n * fh} fill="none" stroke="rgba(255,215,0,0.25)" strokeDasharray={mini ? '1 1' : '3 3'} strokeWidth={mini ? 0.5 : 1} />
    </svg>
  )
}

export default function ElevatorPanel() {
  const open = useTeamStore((s) => s.elevatorOpen)
  const setOpen = useTeamStore((s) => s.setElevatorOpen)
  const floor = useTeamStore((s) => s.floor)
  const me = useTeamStore((s) => s.me)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const changing = useTeamStore((s) => s.floorChanging)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open || !me || me.isGuest) return null

  const byFloor = new Map<number, string[]>()
  for (const f of FLOORS) byFloor.set(f.n, [])
  const push = (n: number, name: string) => {
    const list = byFloor.get(n)
    if (list) list.push(name)
    else byFloor.set(n, [name])
  }
  push(floor, `${me.name.split(' ')[0]} (você)`)
  for (const p of Object.values(remotePlayers)) push(playerFloor(p), p.name.split(' ')[0])
  const counts = new Map<number, number>()
  for (const [n, list] of byFloor) counts.set(n, list.length)

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 130,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: font,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 94vw)',
          background: 'rgba(10,10,20,0.96)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,215,0,0.35)',
          borderRadius: '16px',
          padding: '16px 18px',
          color: '#fff',
          boxShadow: '0 12px 50px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Elevador
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>Andares</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#ddd',
              borderRadius: '8px',
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Fechar (Esc)
          </button>
        </div>

        <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
        {/* Corte do prédio: clicar num andar também viaja */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <BuildingCut floor={floor} counts={counts} onPick={(n) => !changing && requestFloor(n)} />
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Você está aqui</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
          {[...FLOORS].reverse().map((f) => {
            const people = byFloor.get(f.n) ?? []
            const here = f.n === floor
            return (
              <button
                key={f.n}
                onClick={() => {
                  if (!here && !changing) requestFloor(f.n)
                }}
                disabled={here || changing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textAlign: 'left',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: here ? '1px solid rgba(255,215,0,0.6)' : '1px solid rgba(255,255,255,0.12)',
                  background: here ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  cursor: here ? 'default' : 'pointer',
                  fontFamily: font,
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: here ? '#FFD700' : 'rgba(255,255,255,0.1)',
                    color: here ? '#0a0a14' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  {f.n === 0 ? 'T' : f.n}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>
                    {f.name}
                    {f.sub && <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}> · {f.sub}</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {people.length === 0 ? 'Ninguém aqui agora' : people.join(', ')}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: people.length ? 'rgba(76,175,80,0.18)' : 'rgba(255,255,255,0.06)',
                    color: people.length ? '#7ed886' : 'rgba(255,255,255,0.4)',
                    border: people.length ? '1px solid rgba(76,175,80,0.4)' : '1px solid rgba(255,255,255,0.1)',
                    flexShrink: 0,
                  }}
                >
                  {people.length}
                </div>
              </button>
            )
          })}
        </div>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '10px' }}>
          Atalho: F abre este painel em qualquer lugar do prédio.
        </div>
      </div>
    </div>
  )
}
