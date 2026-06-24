// Teste de Fit Cultural UNV — 5 pilares, quiz Likert (1-5) + 1 pergunta aberta (IA).
// Usado por ProfileCulturePublicPage (renderiza) e a edge profile-culture-public-submit
// (recebe as respostas com pillar/reverse e calcula). Banco de perguntas mora aqui.

export interface CulturePillar { key: string; label: string; desc: string; }
export interface CultureQuestion { id: number; pillar: string; text: string; reverse: boolean; }

export const CULTURE_PILLARS: CulturePillar[] = [
  { key: "resultado", label: "Orientação a Resultado", desc: "Cobra-se por meta e número, não por esforço." },
  { key: "dono", label: "Visão de Dono", desc: "Resolve como dono, não espera mandarem." },
  { key: "processo", label: "Disciplina de Processo", desc: "Segue método e registra, mesmo dando trabalho." },
  { key: "velocidade", label: "Velocidade / Execução", desc: "Entrega rápido e ajusta, sem travar no perfeito." },
  { key: "profundidade", label: "Profundidade", desc: "Vai à raiz, não se contenta com o raso." },
];

export const CULTURE_QUESTIONS: CultureQuestion[] = [
  // resultado
  { id: 1, pillar: "resultado", text: "Eu me cobro por metas e resultados, não pelas horas que trabalho.", reverse: false },
  { id: 2, pillar: "resultado", text: "Prefiro ser avaliado por números e entregas do que por esforço.", reverse: false },
  { id: 3, pillar: "resultado", text: "Quando não bato a meta, foco em justificar o motivo.", reverse: true },
  // dono
  { id: 4, pillar: "dono", text: "Quando vejo um problema que 'não é meu', mesmo assim eu resolvo.", reverse: false },
  { id: 5, pillar: "dono", text: "Trato o dinheiro e os recursos da empresa como se fossem meus.", reverse: false },
  { id: 6, pillar: "dono", text: "Prefiro esperar alguém me dizer o que fazer antes de agir.", reverse: true },
  // processo
  { id: 7, pillar: "processo", text: "Sigo processos e registro o que faço, mesmo quando dá mais trabalho.", reverse: false },
  { id: 8, pillar: "processo", text: "Prefiro um método replicável a improvisar a cada vez.", reverse: false },
  { id: 9, pillar: "processo", text: "Acho perda de tempo documentar e padronizar o trabalho.", reverse: true },
  // velocidade
  { id: 10, pillar: "velocidade", text: "Prefiro entregar rápido e ajustar do que esperar o plano perfeito.", reverse: false },
  { id: 11, pillar: "velocidade", text: "Tomo decisão com a informação que tenho, sem ficar travado.", reverse: false },
  { id: 12, pillar: "velocidade", text: "Execução vale mais que teoria pra mim.", reverse: false },
  // profundidade
  { id: 13, pillar: "profundidade", text: "Vou a fundo pra entender a causa real de um problema.", reverse: false },
  { id: 14, pillar: "profundidade", text: "Não me contento com respostas rasas ou genéricas.", reverse: false },
  { id: 15, pillar: "profundidade", text: "Quando algo está 'mais ou menos', deixo como está pra não atrasar.", reverse: true },
];

export const CULTURE_OPEN_QUESTION =
  "Conte uma situação real em que você precisou bater uma meta difícil ou resolver um problema sozinho. O que você fez e qual foi o resultado?";

export const CULTURE_SCALE = [
  { value: 1, label: "Discordo totalmente" },
  { value: 2, label: "Discordo" },
  { value: 3, label: "Neutro" },
  { value: 4, label: "Concordo" },
  { value: 5, label: "Concordo totalmente" },
];
