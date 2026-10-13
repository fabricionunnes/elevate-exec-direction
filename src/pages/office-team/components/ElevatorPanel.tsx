// Painel "Andares" do elevador: lista os andares com quem está em cada um
// (pelo presence). Escolher um andar inicia a viagem (fade + teleporte pra
// frente do elevador no andar novo). Visitante não tem acesso.
import { useEffect } from 'react'
import { useTeamStore, playerFloor } from '../store/useTeamStore'
import { FLOORS } from '../lib/floors'
import { requestFloor } from '../lib/floorTravel'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

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
          width: 'min(420px, 92vw)',
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '10px' }}>
          Atalho: F abre este painel em qualquer lugar do prédio.
        </div>
      </div>
    </div>
  )
}
