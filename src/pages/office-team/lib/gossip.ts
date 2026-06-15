// Repertório da Tia Cleide (faxineira fofoqueira) — 100% local, ZERO tokens.
// Tiazinha clássica: papo de café, novela, tempo, sorte grande, e fofoca
// LEVE e inofensiva do escritório (sem inventar nada negativo de ninguém).
// Fala por voz via Web Speech API do navegador (grátis, sem custo).

const LINES = [
  'Ai, esse chão hoje tava um brinco antes de vocês chegarem.',
  'Sabe o que eu ouvi no corredor? Nada não, esquece. Mas ouvi.',
  'Café passado na hora é outra coisa, viu, meu bem.',
  'Tô varrendo desde cedo e a fofoca tá fraca hoje, hein.',
  'Cê viu a novela ontem? Aquele final, misericórdia!',
  'Trabalhar é bom, mas um cafezinho com prosa é melhor ainda.',
  'Olha, eu não sou de fofoca, mas senta aqui que eu te conto.',
  'Esse pessoal do comercial vive correndo, parece formiguinha.',
  'Tá um calor hoje, ou é só eu que tô a todo vapor varrendo?',
  'Deixa eu te falar: quem deixou a caneca suja na pia foi... ah, deixa pra lá.',
  'No meu tempo era tudo no papel, hoje é tudo nessas telinha.',
  'Já jogou na loteria essa semana? Tô com um palpite bão.',
  'Reunião, reunião, reunião... e o cafezinho, fica pra quando?',
  'Eu vi, viu! Mas não vou contar pra ninguém. Só pra você.',
  'Esse escritório novo ficou chique demais, até medo de sujar.',
  'A planta ali do canto tá precisando de água, ninguém rega não?',
  'Fofoca boa é igual pó: aparece quando menos espera.',
  'Cê tá com uma cara boa hoje, andou dormindo bem, né?',
  'Diz que vem chuva mais tarde. Eu sinto no joelho, nunca falha.',
  'Trabalha bonito, viu. Eu fico de olho em quem se esforça.',
  'Ô meu povo, recolhe esse copo do chão que eu acabei de varrer!',
  'Já te falei que eu conheço a tia de um conhecido do dono? Pois é.',
  'Esse silêncio aqui tá suspeito, alguém aprontou alguma.',
  'Eu adoro um corredor movimentado, dá assunto pro dia todo.',
  'Tá vendo aquela mesa ali? Tem história, mas é segredo.',
  'Bom dia de trabalho é com chão limpo e prosa boa.',
  'Vou te contar baixinho: o café da máquina nova tá melhor, viu.',
  'Cês trabalham muito, hein. No meu tempo tinha mais hora do lanche.',
  'Quem chegou cedo hoje ganhou meu respeito, eu vi tudo.',
  'A vida é uma novela, e eu tô sempre no capítulo bom.',
  'Esse piso encera fácil, mas pra brilhar mesmo é com carinho.',
  'Soube que tem reunião importante hoje. Não vou perguntar de quê... mas é o quê?',
  'Cê viu o preço das coisas? Tá tudo pela hora da morte, viu.',
  'Eu varro, escuto, e guardo tudo aqui na cabecinha.',
  'Pausa pro café faz bem pra alma e pra fofoca.',
  'Olha a postura, meu filho! Endireita essa coluna que eu tô vendo.',
  'Dizem que vai ter novidade por aqui. Eu não disse nada, tá?',
  'Esse cantinho aqui é onde rola as melhores conversas, anota aí.',
  'Tô de olho em quem não lava a própria caneca, viu, espertinho.',
  'A semana tá voando, né? Daqui a pouco é sexta, graças a Deus.',
  'Adoro esse povo, mas que vocês falam alto, falam.',
  'Já rega essa plantinha, recolhe o copo, e me dá um tchau bonito.',
]

function hash(n: number): number {
  let h = n >>> 0
  h = (h ^ (h >> 16)) * 0x45d9f3b
  h = (h ^ (h >> 16)) * 0x45d9f3b
  return (h ^ (h >> 16)) >>> 0
}

/** Fala atual da Tia Cleide — muda a cada ~9s, sem repetir a anterior.
 * Derivada do relógio: todos os clientes veem a mesma. */
export function gossipLine(): { idx: number; text: string } {
  const slot = Math.floor(Date.now() / 9000)
  // passo coprimo com o tamanho da lista evita repetição imediata
  const idx = (hash(slot) % LINES.length)
  return { idx: slot, text: LINES[idx] }
}

// ── Voz do navegador (grátis, sem token) ──
let voicesReady = false
function pickVoice(): SpeechSynthesisVoice | null {
  const vs = speechSynthesis.getVoices()
  return (
    vs.find((v) => /pt-BR/i.test(v.lang) && /luciana|maria|francisca|fem/i.test(v.name)) ??
    vs.find((v) => /pt-BR/i.test(v.lang)) ??
    vs.find((v) => /pt/i.test(v.lang)) ??
    null
  )
}

export function speakGossip(text: string) {
  try {
    if (!('speechSynthesis' in window)) return
    if (!voicesReady) {
      speechSynthesis.getVoices()
      voicesReady = true
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-BR'
    u.rate = 1.03
    u.pitch = 1.35 // voz mais aguda, jeitão de tiazinha
    u.volume = 0.9
    const v = pickVoice()
    if (v) u.voice = v
    speechSynthesis.cancel() // não acumula falas
    speechSynthesis.speak(u)
  } catch {
    /* navegador sem TTS: segue só com o balão */
  }
}
