// Repertório da Tia Cleide (faxineira fofoqueira) — 100% local, ZERO tokens.
// Tiazinha clássica: papo de café, novela, tempo, sorte grande, e fofoca
// LEVE e inofensiva do escritório (sem inventar nada negativo de ninguém).
// Fala por voz via Web Speech API do navegador (grátis, sem custo).

// Falas SEM nome — tiazinha clássica, pra quando não tem o time carregado.
const PLAIN = [
  'Ai, esse chão tava um brinco antes de vocês pisarem nele, viu.',
  'Eu não sou de fofoca não... senta aqui que eu te conto rapidinho.',
  'Café passado na hora é outra história, meu bem.',
  'Cê viu a novela ontem? Aquele final, misericórdia!',
  'Quem foi o anjo que deixou a caneca suja na pia? Tô investigando.',
  'Já jogou na loteria? Tô com um palpite que não erra, anota: 7, 13, 42.',
  'Reunião, reunião, reunião... e o cafezinho fica pra quando, hein?',
  'No meu tempo era tudo no papel. Hoje é tudo nessa telinha brilhando.',
  'Diz que vem chuva. Eu sinto no joelho, é melhor que previsão do tempo.',
  'Ô meu povo, recolhe esse copo do chão que eu ACABEI de varrer!',
  'Segredo comigo morre na hora. Mentira, já contei pra três pessoas.',
  'A vida é uma novela e eu tô sempre no capítulo bom, graças a Deus.',
  'Endireita essa coluna, meu filho! De tanto curvar na cadeira vira camarão.',
  'Esse silêncio tá suspeito demais... alguém aqui aprontou, eu sinto.',
  'Sexta chegando! Já tô ouvindo o churrasco me chamar de longe.',
  'Eu varro, escuto, e guardo tudo aqui na cabecinha. Arquivo vivo, viu.',
]

// Falas COM nome — tiração de sarro AFETUOSA (nunca ofende). Linguagem
// NEUTRA de gênero (sem "o/a", uso de "pra" e "esse povo") pra não errar
// com nome de homem ou mulher. {user}/{user2}
const PERSON = [
  'Olha quem apareceu! {user}, pensei que tinha mudado de endereço.',
  '{user} de novo no cafezinho? Produtividade lá em cima, hein, meu amor.',
  '{user} e {user2} cochichando ali no canto. Eu QUERO saber, viu.',
  'Falei pra {user} que segredo comigo é sagrado. E olha, acreditou.',
  '{user} trabalha tanto que um dia desses eu varro junto sem perceber.',
  'Vi {user} chegar cedo hoje. Anotei na minha listinha dos abençoados.',
  'Cadê {user}? Sumiu igual meu pano de chão na segunda-feira.',
  '{user} tá com cara de quem já tá pensando no almoço. Eu também, confesso.',
  '{user} entrou em reunião e não saiu mais. Mandei café por debaixo da porta.',
  '{user}, capricha nessa câmera que hoje o arraso tá demais, viu, criatura.',
  '{user2} riu da piada de {user}. Dupla de comédia esses dois.',
  '{user} prometeu que ia lavar a caneca. Tô esperando sentada... literalmente.',
  'Toda vez que eu passo, {user} tá numa call. Será que dorme falando também?',
  '{user} é tão concentrado que nem me cumprimenta. Tudo bem, falo sozinha mesmo.',
  '{user} chegou estiloso hoje. Reunião importante ou é só pra me impressionar?',
  '{user} bebe mais café do que eu passo pano. E olha que eu passo MUITO pano.',
  'Vi {user} no corredor, todo pensativo. Tá tramando alguma, eu sinto.',
  '{user2} ainda nem chegou e {user} já fez o trabalho dos dois. Que dupla, hein.',
  '{user} falou que ia "rapidinho" no café faz uma hora. Rapidinho é outro fuso.',
  'Tô de olho em {user}. Não fez nada, mas eu fico de olho por precaução.',
  '{user}, larga esse teclado e vem tomar um café com a tia, vai.',
  'Se trabalho rendesse fofoca, {user} já era milionário com o que eu sei.',
]

// Piadinhas de despedida — quando ela cansa de prosa e volta a trabalhar
const FAREWELL = [
  'Ai, vocês tão com a vida ganha, hein! Deixa eu trabalhar, vai.',
  'Tá bom, tá bom, chega de prosa. Esse chão não se varre sozinho.',
  'Fofoca boa, mas o serviço chama. Já volto pra próxima fofoca!',
  'Olha, adoro vocês, mas a vassoura tá com ciúme. Tchau, tchau!',
  'Enquanto vocês relaxam, a tia aqui é que segura o escritório, viu.',
  'Vou indo que se o chefe me vê parada, corta meu cafezinho.',
  'Bom, prosa é bom mas não paga as contas. Deixa eu ir, meu povo.',
]

export function farewellLine(staff: string[] = []): string {
  const h = hashTime()
  const t = FAREWELL[h % FAREWELL.length]
  return fill(t, h, staff)
}

function hashTime(): number {
  return hash(Math.floor(Date.now() / 1000))
}

function hash(n: number): number {
  let h = n >>> 0
  h = (h ^ (h >> 16)) * 0x45d9f3b
  h = (h ^ (h >> 16)) * 0x45d9f3b
  return (h ^ (h >> 16)) >>> 0
}

function fill(text: string, seed: number, staff: string[]): string {
  if (!text.includes('{user')) return text
  const pool = staff.length ? staff : ['o pessoal']
  const a = pool[hash(seed * 31 + 7) % pool.length]
  const b = pool[(hash(seed * 31 + 7) + 1 + (hash(seed * 53) % Math.max(1, pool.length - 1))) % pool.length]
  return text.replace(/\{user2\}/g, b).replace(/\{user\}/g, a)
}

/** Fala atual da Tia Cleide — muda a cada ~9s, sem repetir a anterior.
 * Intercala piada com nome real do time e tiazinha clássica. Determinística
 * pelo relógio (todos veem a mesma) e SEM token. */
export function gossipLine(staff: string[] = []): { idx: number; text: string } {
  const slot = Math.floor(Date.now() / 9000)
  const h = hash(slot)
  // 2 em cada 3 falas mencionam alguém do time (quando há nomes carregados)
  const usePerson = staff.length > 0 && h % 3 !== 0
  const text = usePerson ? fill(PERSON[h % PERSON.length], slot * 101 + 5, staff) : PLAIN[h % PLAIN.length]
  return { idx: slot, text }
}

// ── Voz do navegador (grátis, sem token) ──
// Prioriza vozes NATURAIS (Google pt-BR / online / enhanced) — as locais
// "compact" soam robóticas. As vozes carregam de forma assíncrona, então
// resolvemos no evento voiceschanged.
let cachedVoice: SpeechSynthesisVoice | null = null
function resolveVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null
  const vs = speechSynthesis.getVoices()
  if (!vs.length) return cachedVoice
  cachedVoice =
    vs.find((v) => /pt[-_]?BR/i.test(v.lang) && /google/i.test(v.name)) ?? // Google = bem natural
    vs.find((v) => /pt[-_]?BR/i.test(v.lang) && /(natural|online|enhanced|premium|siri|luciana)/i.test(v.name)) ??
    vs.find((v) => /pt[-_]?BR/i.test(v.lang) && !/compact|eloquence|espeak/i.test(v.name)) ??
    vs.find((v) => /pt[-_]?BR/i.test(v.lang)) ??
    vs.find((v) => /^pt/i.test(v.lang)) ??
    null
  return cachedVoice
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  resolveVoice()
  speechSynthesis.onvoiceschanged = () => resolveVoice()
}

export function speakGossip(text: string) {
  try {
    if (!('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(text)
    const v = cachedVoice ?? resolveVoice()
    if (v) u.voice = v
    u.lang = v?.lang ?? 'pt-BR'
    // Tom natural: voz feminina sem exagero (pitch alto = robótico/cartoon)
    u.rate = 0.98
    u.pitch = 1.08
    u.volume = 0.95
    speechSynthesis.cancel() // não acumula falas
    speechSynthesis.speak(u)
  } catch {
    /* navegador sem TTS: segue só com o balão */
  }
}
