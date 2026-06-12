// Motor de diálogos do café — 100% local, ZERO tokens de IA.
// Mini-roteiros de pergunta/resposta com lacunas preenchidas por nomes REAIS
// (time e clientes ativos, sempre em tom positivo). A escolha de roteiro,
// nomes e turno é derivada do relógio (determinística: todos veem o mesmo),
// e roteiros consecutivos nunca se repetem (passo coprimo na rotação).
// REGRA: nada de números, métricas ou assuntos sensíveis — papo de café.
import { supabase } from '@/integrations/supabase/client'

export interface DialogueTurn {
  who: 'A' | 'B'
  text: string
}

// {user}/{user2} = colaborador · {client} = cliente ativo (sempre elogio)
const SCRIPTS: DialogueTurn[][] = [
  [
    { who: 'A', text: 'Viu o atendimento que {user} fez ontem?' },
    { who: 'B', text: 'Vi. O pessoal da {client} saiu elogiando.' },
    { who: 'A', text: 'É disso que eu tô falando. Padrão alto.' },
    { who: 'B', text: 'Padrão UNV. Café pra comemorar.' },
  ],
  [
    { who: 'A', text: 'Esse café tá forte hoje, hein.' },
    { who: 'B', text: 'Do jeito que eu gosto.' },
    { who: 'A', text: 'Forte igual o ritmo de {user} essa semana.' },
    { who: 'B', text: 'Aquilo lá não para. Inspirador.' },
  ],
  [
    { who: 'A', text: 'Tô gostando de ver a {client} evoluindo.' },
    { who: 'B', text: 'Demais. O time deles comprou a ideia.' },
    { who: 'A', text: 'Quando o cliente joga junto, vai longe.' },
    { who: 'B', text: 'E com {user} acompanhando de perto, vai mais longe ainda.' },
  ],
  [
    { who: 'A', text: 'Se eu tomar mais um desses, viro a madrugada.' },
    { who: 'B', text: 'Você é um robô. Você JÁ vira a madrugada.' },
    { who: 'A', text: 'Detalhe técnico.' },
    { who: 'B', text: 'Há. Me serve mais um também.' },
  ],
  [
    { who: 'A', text: '{user} me pediu uma coisa ontem que me deixou pensando.' },
    { who: 'B', text: 'Coisa boa?' },
    { who: 'A', text: 'Ideia boa. Esse time pensa grande.' },
    { who: 'B', text: 'Por isso eu gosto daqui.' },
  ],
  [
    { who: 'A', text: 'A reunião com a {client} hoje foi redonda.' },
    { who: 'B', text: 'Ouvi dizer. {user} conduziu bem demais.' },
    { who: 'A', text: 'Preparação é tudo.' },
    { who: 'B', text: 'Preparação e café. Nessa ordem? Não sei.' },
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
    { who: 'A', text: 'O onboarding da {client} foi dos mais rápidos que já vi.' },
    { who: 'B', text: 'Time afiado dos dois lados.' },
    { who: 'A', text: 'Cliente bom merece entrega boa.' },
    { who: 'B', text: 'E entrega boa traz cliente bom. Ciclo virtuoso.' },
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
    { who: 'A', text: 'Recebi um obrigado da {client} hoje.' },
    { who: 'B', text: 'Espontâneo? Esses valem ouro.' },
    { who: 'A', text: 'Espontâneo. Guardei no meu banco de memórias.' },
    { who: 'B', text: 'Robô sentimental. Gostei.' },
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
    { who: 'A', text: 'A {client} renovou com a gente, soube?' },
    { who: 'B', text: 'Soube! Renovação é o melhor elogio que existe.' },
    { who: 'A', text: 'Resultado de trabalho bem feito o ano todo.' },
    { who: 'B', text: 'Brinde com café. Tim-tim.' },
  ],
  [
    { who: 'A', text: 'Viu que {user} chegou cedo de novo hoje?' },
    { who: 'B', text: 'Vi. Aquela energia contagia o escritório.' },
    { who: 'A', text: 'Exemplo arrasta mais que discurso.' },
    { who: 'B', text: 'Anotei essa. Vou usar.' },
  ],
  [
    { who: 'A', text: 'Me conta uma coisa boa da semana.' },
    { who: 'B', text: 'O feedback que a {client} mandou. E a sua?' },
    { who: 'A', text: 'Ver {user} resolvendo aquele desafio com calma.' },
    { who: 'B', text: 'Semana boa, então. Que venham as próximas.' },
  ],
  [
    { who: 'A', text: 'Esse cafezinho virtual tem gosto de quê pra você?' },
    { who: 'B', text: 'De pausa merecida. E o seu?' },
    { who: 'A', text: 'De energia pra próxima entrega.' },
    { who: 'B', text: 'Cada um com seu sabor. Bonito isso.' },
  ],
]

/** Falas do agente convocado por aceno, com autorização (menciona time/clientes — sem números). */
const SOLO_ALLOWED = [
  'E aí! Bom te ver fora da tela.',
  'Esse café tá no ponto. Prova aí.',
  'O time falou bem do seu trabalho essa semana, viu?',
  'A {client} anda contente com a gente. Dá gosto.',
  'Pausa boa rende mais que hora extra. Comprovado.',
  '{user} comentou uma ideia boa hoje. Esse time pensa.',
  'Se precisar de mim depois, é só clicar. Mas agora: café.',
  'O escritório fica melhor com gente circulando.',
  'Dia puxado? Café resolve metade. A outra metade é foco.',
  'Tô de olho nas suas entregas. Tá num bom caminho.',
  'A {client} é daqueles clientes que jogam junto. Bom trabalhar assim.',
  'Qualquer coisa que travar, me chama que a gente destrava junto.',
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

// ── Nomes reais (cache local, sem custo) ──
let namesCache: { staff: string[]; clients: string[]; ts: number } = { staff: [], clients: [], ts: 0 }

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

function hash(n: number): number {
  let h = n >>> 0
  h = (h ^ (h >> 16)) * 0x45d9f3b
  h = (h ^ (h >> 16)) * 0x45d9f3b
  return (h ^ (h >> 16)) >>> 0
}

function fill(text: string, seed: number, names: { staff: string[]; clients: string[] }): string {
  const staff = names.staff.length > 0 ? names.staff : ['o time']
  const clients = names.clients.length > 0 ? names.clients : ['um cliente']
  const user = staff[hash(seed * 31 + 7) % staff.length]
  const user2 = staff[(hash(seed * 31 + 7) + 1 + (hash(seed * 53) % Math.max(1, staff.length - 1))) % staff.length]
  const client = clients[hash(seed * 17 + 3) % clients.length]
  return text.replace('{user2}', user2).replace('{user}', user).replace('{client}', client)
}

/** Linha do diálogo do café em dupla: roteiros encadeados sem repetição
 * imediata (passo 7, coprimo com o tamanho da lista). */
export function cafeDialogueLine(
  slot: number,
  turn: number,
  names: { staff: string[]; clients: string[] }
): { who: 'A' | 'B'; text: string } {
  const chunk = Math.floor(turn / 4) // a cada 4 turnos muda o roteiro
  const scriptIdx = (hash(slot * 13 + 5) + chunk * 7) % SCRIPTS.length
  const script = SCRIPTS[scriptIdx]
  const line = script[turn % 4 >= script.length ? script.length - 1 : turn % 4]
  return { who: line.who, text: fill(line.text, slot * 101 + scriptIdx, names) }
}

/** Fala do agente convocado por aceno (rotação sem repetição imediata). */
export function summonLine(
  ts: number,
  turn: number,
  allowed: boolean,
  names: { staff: string[]; clients: string[] }
): string {
  const pool = allowed ? SOLO_ALLOWED : SOLO_SMALL_TALK
  const idx = (hash(Math.floor(ts / 1000) * 97) + turn * 5) % pool.length
  return fill(pool[idx], ts + turn * 7, names)
}
