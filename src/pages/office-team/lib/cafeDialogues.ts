// Motor de diálogos do café — 100% local, ZERO tokens de IA.
//
// Duas fontes de conteúdo:
// 1. FATOS REAIS (view office_cafe_facts): reuniões realizadas e tarefas
//    concluídas nos últimos 7 dias — pessoa, cliente e título vêm do MESMO
//    registro (nunca misturados: quem conduziu é quem conduziu de verdade).
// 2. Roteiros sociais: humor e elogios de característica, SEM inventar
//    acontecimentos (nada de "fulano fez X pra cliente Y" fora dos fatos).
//
// A escolha de roteiro/fato/turno é derivada do relógio (determinística:
// todos veem o mesmo) com rotação sem repetição imediata. Sem números.
import { supabase } from '@/integrations/supabase/client'

export interface DialogueTurn {
  who: 'A' | 'B'
  text: string
}

export interface CafeFact {
  kind: 'meeting' | 'task'
  title: string
  person: string
  client: string
  dt: string
}

// ── Roteiros sociais (sem claims factuais) · {user} = colaborador real ──
const SOCIAL_SCRIPTS: DialogueTurn[][] = [
  [
    { who: 'A', text: 'Esse café tá forte hoje, hein.' },
    { who: 'B', text: 'Do jeito que eu gosto.' },
    { who: 'A', text: 'Forte igual o ritmo de {user}.' },
    { who: 'B', text: 'Aquilo lá não para. Inspirador.' },
  ],
  [
    { who: 'A', text: 'Se eu tomar mais um desses, viro a madrugada.' },
    { who: 'B', text: 'Você é um robô. Você JÁ vira a madrugada.' },
    { who: 'A', text: 'Detalhe técnico.' },
    { who: 'B', text: 'Há. Me serve mais um também.' },
  ],
  [
    { who: 'A', text: 'Qual sua parte favorita do escritório novo?' },
    { who: 'B', text: 'Esse lounge, fácil. E a sua?' },
    { who: 'A', text: 'O letreiro da fachada. Dá orgulho de chegar.' },
    { who: 'B', text: 'Chegar de Porsche então, nem se fala.' },
  ],
  [
    { who: 'A', text: 'Você dorme, ou fica aí pensando em funil?' },
    { who: 'B', text: 'Eu hiberno sonhando com processo bem desenhado.' },
    { who: 'A', text: 'Que sonho lindo.' },
    { who: 'B', text: 'Melhor que contar carneirinho.' },
  ],
  [
    { who: 'A', text: 'Sabe o que eu admiro em {user}?' },
    { who: 'B', text: 'Diz.' },
    { who: 'A', text: 'Constância. Todo dia no mesmo nível.' },
    { who: 'B', text: 'Constância ganha de talento que aparece às vezes.' },
  ],
  [
    { who: 'A', text: 'Esse lofi de fundo melhora até meu processamento.' },
    { who: 'B', text: 'Cientificamente discutível, mas concordo.' },
    { who: 'A', text: 'Música boa, café bom, time bom.' },
    { who: 'B', text: 'Dia perfeito pra construir coisa grande.' },
  ],
  [
    { who: 'A', text: '{user} e {user2} formam uma dupla boa, né?' },
    { who: 'B', text: 'Um puxa o outro pra cima. É bonito de ver.' },
    { who: 'A', text: 'Time que se gosta entrega mais.' },
    { who: 'B', text: 'E reclama menos do café. Vantagem dupla.' },
  ],
  [
    { who: 'A', text: 'Se você pudesse tirar férias, ia pra onde?' },
    { who: 'B', text: 'Pra um datacenter na Islândia. Friozinho bom.' },
    { who: 'A', text: 'Eu ia pro litoral. Processar o som do mar.' },
    { who: 'B', text: 'Poético. Mas a gente ia sentir falta daqui em dois dias.' },
  ],
  [
    { who: 'A', text: 'A energia de {user} contagia o escritório.' },
    { who: 'B', text: 'Contagia mesmo. Exemplo arrasta mais que discurso.' },
    { who: 'A', text: 'Anotei essa. Vou usar.' },
    { who: 'B', text: 'Direitos autorais: um expresso.' },
  ],
  [
    { who: 'A', text: 'Esse cafezinho virtual tem gosto de quê pra você?' },
    { who: 'B', text: 'De pausa merecida. E o seu?' },
    { who: 'A', text: 'De energia pra próxima entrega.' },
    { who: 'B', text: 'Cada um com seu sabor. Bonito isso.' },
  ],
]

// ── Roteiros de FATO · {person}/{client}/{title}/{day} vêm do mesmo registro ──
const MEETING_SCRIPTS: DialogueTurn[][] = [
  [
    { who: 'A', text: '{person} teve reunião com a {client} {day}.' },
    { who: 'B', text: '"{title}", né? Fiquei sabendo.' },
    { who: 'A', text: 'Cliente acompanhado de perto é cliente bem servido.' },
    { who: 'B', text: 'Assim que se constrói confiança.' },
  ],
  [
    { who: 'A', text: 'Viu a agenda? "{title}" com a {client}, {day}.' },
    { who: 'B', text: 'Com {person} à frente. Agenda girando.' },
    { who: 'A', text: 'Agenda girando, cliente evoluindo.' },
    { who: 'B', text: 'Café pra brindar isso.' },
  ],
  [
    { who: 'A', text: 'A {client} esteve em pauta {day}.' },
    { who: 'B', text: 'Na "{title}", com {person}.' },
    { who: 'A', text: 'Acompanhamento em dia. Gosto de ver.' },
    { who: 'B', text: 'Rotina bem feita aparece no resultado.' },
  ],
]

const TASK_SCRIPTS: DialogueTurn[][] = [
  [
    { who: 'A', text: '{person} concluiu "{title}" pra {client}.' },
    { who: 'B', text: 'Vi no sistema. Entrega limpa.' },
    { who: 'A', text: 'Tarefa fechada é confiança ganha.' },
    { who: 'B', text: 'Checklist que anda, cliente que fica.' },
  ],
  [
    { who: 'A', text: 'Saiu do forno {day}: "{title}".' },
    { who: 'B', text: 'Da conta da {client}, trabalho de {person}.' },
    { who: 'A', text: 'Gosto de ver o board andando.' },
    { who: 'B', text: 'Eu também. Café pra celebrar.' },
  ],
  [
    { who: 'A', text: 'Mais uma entregue: "{title}", da {client}.' },
    { who: 'B', text: '{person} que tocou. Ritmo bom.' },
    { who: 'A', text: 'Ritmo de time profissional.' },
    { who: 'B', text: 'Do jeito que a casa gosta.' },
  ],
]

/** Aceno no CAFÉ (autorizado): papo leve de pausa. */
const SOLO_ALLOWED = [
  'E aí! Bom te ver fora da tela.',
  'Esse café tá no ponto. Prova aí.',
  'Pausa boa rende mais que hora extra. Comprovado.',
  'Se precisar de mim depois, é só clicar. Mas agora: café.',
  'O escritório fica melhor com gente circulando.',
  'Dia puxado? Café resolve metade. A outra metade é foco.',
  'Qualquer coisa que travar, me chama que a gente destrava junto.',
  'Time em movimento — é disso que eu gosto.',
]

/** Aceno na SALA PRIVADA (autorizado): conversa de negócios / dia a dia. */
const SOLO_OFFICE = [
  'Sentou? Então me conta como tá o dia.',
  'Bora alinhar. O que tá tirando seu sono essa semana?',
  'Que prioridade você quer destravar hoje?',
  'Manda o que precisa que eu organizo com você.',
  'Vamos olhar o que importa: onde você quer foco agora?',
  'Tô aqui pra ajudar a decidir. Qual o ponto?',
  'Se quiser, a gente revisa as metas e os próximos passos.',
  'Me diz onde tá o gargalo que a gente ataca junto.',
  'Pronto pra trabalhar. Por onde começamos?',
  'Reunião rápida e prática — do jeito que a casa gosta.',
]

/** Templates de fato pro aceno autorizado (preenchidos com registro real). */
const SOLO_FACT_MEETING = [
  'Vi que {person} esteve com a {client} {day}. Acompanhamento em dia.',
  '"{title}" com a {client} aconteceu {day} — agenda girando.',
]
const SOLO_FACT_TASK = [
  'Saiu "{title}" pra {client}, {day}. Trabalho de {person}.',
  '{person} fechou "{title}" da {client}. Board andando.',
]

/** Falas pra quem NÃO tem autorização: papo 100% informal — nada de
 * sistema, empresa, clientes ou colegas. */
const SOLO_SMALL_TALK = [
  'E aí, como tá o dia?',
  'Esse café tá no ponto.',
  'Pausa boa é pausa curta — mas essa vale.',
  'Eu funciono à base de cafeína estatística.',
  'Esse lounge ficou bom demais.',
  'Dizem que café une mais que reunião.',
  'Se eu pudesse, pedia um expresso duplo.',
  'Essa lofi de fundo é boa demais.',
  'Sabia que eu nunca durmo? Mas café eu não dispenso.',
  'O melhor lugar do escritório? Exatamente este banco.',
  'Hoje o dia tá bonito até pra quem vê em pixels.',
  'Robô também precisa de pausa. Quem diria.',
  'Você prefere café coado ou expresso? Eu sou team binário.',
  'Um dia ainda inventam café sem fim. Vou ser o primeiro da fila.',
]

// ── Dados reais (cache local, sem custo de IA) ──
let namesCache: { staff: string[]; clients: string[]; ts: number } = { staff: [], clients: [], ts: 0 }
let factsCache: { facts: CafeFact[]; ts: number } = { facts: [], ts: 0 }

export async function getCafeNames(): Promise<{ staff: string[]; clients: string[] }> {
  if (Date.now() - namesCache.ts > 600_000) {
    const [staffRes, clientRes] = await Promise.all([
      supabase.from('office_team_directory' as never).select('name'),
      supabase.from('office_cafe_clients' as never).select('name'),
    ])
    namesCache = {
      staff: ((staffRes.data ?? []) as Array<{ name: string }>).map((r) => r.name.split(' ')[0]),
      clients: ((clientRes.data ?? []) as Array<{ name: string }>).map((r) => r.name),
      ts: Date.now(),
    }
  }
  return namesCache
}

export async function getCafeFacts(): Promise<CafeFact[]> {
  if (Date.now() - factsCache.ts > 600_000) {
    const { data } = await supabase.from('office_cafe_facts' as never).select('*')
    factsCache = { facts: ((data ?? []) as unknown as CafeFact[]).filter((f) => f.person && f.client), ts: Date.now() }
  }
  return factsCache.facts
}

function hash(n: number): number {
  let h = n >>> 0
  h = (h ^ (h >> 16)) * 0x45d9f3b
  h = (h ^ (h >> 16)) * 0x45d9f3b
  return (h ^ (h >> 16)) >>> 0
}

function relativeDay(dt: string): string {
  const d = new Date(dt)
  const today = new Date()
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  return 'essa semana'
}

function clip(s: string, max = 42): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** Preenche um roteiro de FATO — tudo do MESMO registro real. */
function fillFact(text: string, fact: CafeFact): string {
  return text
    .replace('{person}', fact.person)
    .replace('{client}', clip(fact.client, 34))
    .replace('{title}', clip(fact.title))
    .replace('{day}', relativeDay(fact.dt))
}

/** Preenche roteiro social — só nomes de colaboradores (sem claims). */
function fillSocial(text: string, seed: number, staff: string[]): string {
  const pool = staff.length > 0 ? staff : ['o time']
  const user = pool[hash(seed * 31 + 7) % pool.length]
  const user2 = pool[(hash(seed * 31 + 7) + 1 + (hash(seed * 53) % Math.max(1, pool.length - 1))) % pool.length]
  return text.replace('{user2}', user2).replace('{user}', user)
}

/** Linha do diálogo do café em dupla: alterna roteiros de FATO REAL e
 * sociais, com rotação sem repetição imediata. */
export function cafeDialogueLine(
  slot: number,
  turn: number,
  names: { staff: string[]; clients: string[] },
  facts: CafeFact[]
): { who: 'A' | 'B'; text: string } {
  const chunk = Math.floor(turn / 4) // a cada 4 turnos muda o assunto
  const useFact = facts.length > 0 && chunk % 2 === 1 // intercala social/fato

  if (useFact) {
    const fact = facts[(hash(slot * 19 + 1) + Math.floor(chunk / 2) * 7) % facts.length]
    const scripts = fact.kind === 'meeting' ? MEETING_SCRIPTS : TASK_SCRIPTS
    const script = scripts[(hash(slot * 13 + 5) + chunk * 3) % scripts.length]
    const line = script[Math.min(turn % 4, script.length - 1)]
    return { who: line.who, text: fillFact(line.text, fact) }
  }

  const script = SOCIAL_SCRIPTS[(hash(slot * 13 + 5) + chunk * 7) % SOCIAL_SCRIPTS.length]
  const line = script[Math.min(turn % 4, script.length - 1)]
  return { who: line.who, text: fillSocial(line.text, slot * 101 + chunk, names.staff) }
}

/** Fala do agente convocado por aceno (fatos reais quando autorizado).
 * context 'office' = conversa de negócios na sala; 'cafe' = papo de pausa. */
export function summonLine(
  ts: number,
  turn: number,
  allowed: boolean,
  facts: CafeFact[],
  context: 'cafe' | 'office'
): string {
  if (!allowed) {
    const idx = (hash(Math.floor(ts / 1000) * 97) + turn * 5) % SOLO_SMALL_TALK.length
    return SOLO_SMALL_TALK[idx]
  }
  // A cada 3 falas, uma é um fato real do sistema
  if (facts.length > 0 && turn % 3 === 2) {
    const fact = facts[(hash(Math.floor(ts / 1000) * 41) + Math.floor(turn / 3) * 5) % facts.length]
    const templates = fact.kind === 'meeting' ? SOLO_FACT_MEETING : SOLO_FACT_TASK
    return fillFact(templates[hash(ts + turn) % templates.length], fact)
  }
  const pool = context === 'office' ? SOLO_OFFICE : SOLO_ALLOWED
  const idx = (hash(Math.floor(ts / 1000) * 97) + turn * 5) % pool.length
  return pool[idx]
}
