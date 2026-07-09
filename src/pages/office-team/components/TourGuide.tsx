// Tour de boas-vindas conduzido pelo MAX (CEO IA): na primeira entrada,
// convida pro tour; o MAX anda na frente (override da rotina dele) com um
// balão curto, o usuário segue automaticamente e o painel embaixo traz a
// explicação completa com Próximo/Pular. Roda uma vez (localStorage).
import { useEffect, useState } from 'react'
import { useTeamStore } from '../store/useTeamStore'

const DONE_KEY = 'office-tour-done'

interface TourStep {
  x: number
  z: number
  /** balão curto sobre o MAX (até ~64 chars) */
  bubble: string
  /** explicação completa no painel */
  text: string
}

const STEPS: TourStep[] = [
  {
    x: 0,
    z: 12,
    bubble: 'Bem-vindo ao UNV Office! Vem comigo.',
    text: 'Eu sou o MAX, o CEO dos agentes IA. Esse é o escritório virtual da UNV: aqui o time trabalha junto, se encontra e fecha negócio — de qualquer lugar. Anda comigo que eu te mostro tudo (WASD ou duplo clique pra andar).',
  },
  {
    x: -2,
    z: 0.5,
    bubble: 'Aqui ficam os setores e os agentes IA.',
    text: 'Comercial, Produto, Marketing, Financeiro e Liderança. As TVs mostram dados REAIS ao vivo, e o termômetro do Comercial acompanha a meta do mês. Os robôs são os agentes IA — clica neles pra conversar (o acesso é liberado pelo Fabrício).',
  },
  {
    x: -21,
    z: 12.4,
    bubble: 'Reunião Principal — agenda na porta.',
    text: 'A placa na porta mostra a agenda do dia. Lá dentro, o botão ⏺ grava a reunião em vídeo — a transcrição e a ata em PDF saem sozinhas. A tela compartilhada aparece no telão da sala.',
  },
  {
    x: 19,
    z: 7,
    bubble: 'Café & Lounge — papo informal.',
    text: 'Senta numa banqueta pra tomar um café — com 2+ pessoas na mesinha, os balões de conversa aparecem pra todo mundo (papo informal!). Até nós, agentes, descemos pro café de vez em quando.',
  },
  {
    x: 0,
    z: 21,
    bubble: 'Ala das salas privadas.',
    text: 'Sua sala tem seu nome. Aperta X pra ir direto e sentar na sua cadeira. Z tranca a sala (ninguém de fora vê nem ouve). Dá até pra ligar uma lofi no painel de música. E F ativa o modo foco — cutucadas são respondidas sozinhas.',
  },
  {
    x: 0,
    z: 12,
    bubble: 'É isso. Bora pra cima!',
    text: 'Qualquer dúvida, me chama na sala da Liderança ou cutuca alguém do time pelo painel Equipe (🔔). Bom trabalho — e bora pra cima.',
  },
]

export default function TourGuide() {
  const me = useTeamStore((s) => s.me)
  const setTour = useTeamStore((s) => s.setTour)
  const rooms = useTeamStore((s) => s.rooms)
  const [invite, setInvite] = useState(false)
  const [step, setStep] = useState<number | null>(null)

  // Primeira entrada (e salas carregadas): oferece o tour
  useEffect(() => {
    if (!me || me.isGuest || rooms.length === 0) return
    if (localStorage.getItem(DONE_KEY)) return
    const t = setTimeout(() => setInvite(true), 6000)
    return () => clearTimeout(t)
  }, [me, rooms.length])

  const finish = () => {
    localStorage.setItem(DONE_KEY, '1')
    setInvite(false)
    setStep(null)
    setTour(null)
  }

  const goToStep = (i: number) => {
    if (i >= STEPS.length) {
      finish()
      return
    }
    const s = STEPS[i]
    setStep(i)
    setTour({ x: s.x, z: s.z, text: s.bubble })
    // O usuário segue o MAX automaticamente (pode andar por conta com WASD)
    useTeamStore.getState().setPendingWalkTo({ x: s.x + 0.8, z: s.z + 1.4 })
  }

  if (!me || me.isGuest) return null
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  // Convite inicial
  if (invite && step === null) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '90px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 110,
          background: 'rgba(10,10,20,0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,215,0,0.4)',
          borderRadius: '16px',
          padding: '16px 20px',
          width: 'min(440px, 92vw)',
          fontFamily: font,
          color: '#fff',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#0D2B5E',
              border: '1px solid #FFD700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
            }}
          >
            🤖
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '14px' }}>
              MAX <span style={{ color: '#FFD700', fontWeight: 600, fontSize: '12px' }}>· CEO IA</span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>
              Primeira vez por aqui? Te mostro o escritório em 1 minuto.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={() => {
              setInvite(false)
              goToStep(0)
            }}
            style={{
              flex: 1,
              background: '#0D2B5E',
              border: '1px solid #FFD700',
              borderRadius: '10px',
              padding: '9px',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Fazer o tour com o MAX
          </button>
          <button
            onClick={finish}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '9px 14px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Agora não
          </button>
        </div>
      </div>
    )
  }

  if (step === null) return null
  const s = STEPS[step]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '90px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 110,
        background: 'rgba(10,10,20,0.94)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,215,0,0.35)',
        borderRadius: '16px',
        padding: '14px 18px',
        width: 'min(500px, 92vw)',
        fontFamily: font,
        color: '#fff',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>🤖</span>
        <span style={{ fontWeight: 800, fontSize: '13px' }}>MAX</span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
          · tour {step + 1} de {STEPS.length}
        </span>
      </div>
      <div style={{ fontSize: '13px', lineHeight: 1.55, color: 'rgba(255,255,255,0.88)' }}>{s.text}</div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={finish}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '8px 10px',
          }}
        >
          Pular tour
        </button>
        <button
          onClick={() => goToStep(step + 1)}
          style={{
            background: '#0D2B5E',
            border: '1px solid #FFD700',
            borderRadius: '10px',
            padding: '8px 18px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {step + 1 === STEPS.length ? 'Concluir' : 'Próximo →'}
        </button>
      </div>
    </div>
  )
}
