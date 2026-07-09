import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircleQuestion } from "lucide-react";

// Banco de perguntas NEPQ (Neuro-Emotional Persuasion Questioning) por segmento.
// Conteúdo original, adaptado ao negócio da UNV (direção comercial pra PMEs).
// Base = "generico"; cada segmento só sobrescreve as fases onde uma pergunta
// específica agrega (situação/problema/sondagem/solução/consequência).

const SEGMENTS = [
  { key: "generico", label: "Genérico" },
  { key: "academia", label: "Academia / Studio" },
  { key: "clinica", label: "Clínica (estética/saúde)" },
  { key: "escola", label: "Escola / Curso" },
  { key: "comercio", label: "Comércio / Varejo" },
];

const PHASES: { n: number; name: string }[] = [
  { n: 1, name: "Conexão" },
  { n: 2, name: "Contexto & Expectativas" },
  { n: 3, name: "Tomadores de Decisão" },
  { n: 4, name: "Situação" },
  { n: 5, name: "Consciência do Problema" },
  { n: 6, name: "Sondagem de Precisão" },
  { n: 7, name: "O que já tentou" },
  { n: 8, name: "Consciência da Solução" },
  { n: 9, name: "Consequência" },
  { n: 10, name: "Qualificação" },
  { n: 11, name: "Transição & Apresentação" },
  { n: 12, name: "Compromisso & Preço" },
];

const GENERICO: Record<number, string[]> = {
  1: [
    "Antes de entrar em qualquer coisa, me conta rapidinho: como está o comercial da empresa hoje, na sua visão?",
    "O que te fez responder e reservar essa sessão agora, e não daqui a uns meses?",
  ],
  2: [
    "Pra essa conversa ser útil de verdade, posso te fazer algumas perguntas pra entender seu cenário antes de sugerir qualquer coisa — tudo bem?",
    "No fim daqui, o que precisaria acontecer pra você sentir que valeu a pena ter conversado?",
  ],
  3: [
    "Se fizer sentido seguir, tem mais alguém que participa dessa decisão junto com você?",
    "Como costuma ser quando vocês decidem investir em algo assim — é só você ou tem sócio/parceiro no processo?",
  ],
  4: [
    "Como funciona a venda hoje: quem vende, quantas pessoas no time, tem meta e processo definidos?",
    "Quantos leads chegam por mês e quanto disso vira cliente, mais ou menos?",
  ],
  5: [
    "Onde você sente que trava hoje — é chegar lead, é converter, ou é o time executar sem depender de você?",
    "Quando não bate meta, o que costuma ser o motivo, na sua leitura?",
  ],
  6: [
    "Interessante… quando você fala isso, como aparece no dia a dia da empresa?",
    "E isso vem acontecendo há quanto tempo?",
  ],
  7: [
    "O que você já tentou pra resolver isso? E por que acha que não deu o resultado que queria?",
    "Já teve vendedor ou consultoria antes? Como foi?",
  ],
  8: [
    "Se daqui a 6 meses o comercial estivesse rodando redondo sem depender de você, o que estaria diferente na sua rotina?",
    "Como seria o cenário ideal — o que precisaria estar acontecendo pra você dizer 'agora sim'?",
  ],
  9: [
    "E se continuar do jeito que está pelos próximos 12 meses, o que isso te custa — em faturamento e em tempo seu?",
    "O que te preocupa mais: ficar como está ou mexer e dar trabalho no começo?",
  ],
  10: [
    "Numa escala de 0 a 10, o quanto resolver isso é prioridade pra você hoje — e por quê esse número?",
    "O que muda pra você (e pro negócio) quando isso estiver resolvido?",
  ],
  11: [
    "Pelo que você me contou, faz sentido eu te mostrar como a gente resolveria exatamente isso?",
    "Deixa eu te mostrar como funcionaria no seu caso, ligando com cada ponto que você falou…",
  ],
  12: [
    "Faz sentido pra você o que apresentei? O que te impediria de começar?",
    "Considerando o que ficar parado te custa, o investimento faz sentido — quer que eu já organize o próximo passo?",
  ],
};

const OVERRIDES: Record<string, Record<number, string[]>> = {
  academia: {
    4: [
      "Quantos alunos ativos você tem hoje e como estão as matrículas e a renovação por mês?",
      "Quem faz a venda e o pós-venda — recepção, professor, ou você mesmo?",
    ],
    5: [
      "O que trava mais: trazer aluno novo, converter a aula experimental, ou reter quem já é aluno?",
      "Como está a evasão — de cada 10 que entram, quantos ficam depois de 3 meses?",
    ],
    6: ["Quando você perde aluno, isso acontece mais em qual momento — na experimental, no 1º mês, ou na renovação?"],
    8: ["Se a recepção convertesse cada visita e a renovação fosse trabalhada com antecedência, o que isso faria pelo seu caixa?"],
    9: ["Cada aluno que não renova, quanto é por mês? Multiplicando pelos que saem sem ninguém acompanhar, quanto vaza no ano?"],
  },
  clinica: {
    4: [
      "Quantos pacientes/procedimentos por mês e qual o ticket médio? Quem agenda e faz o follow-up?",
      "Os leads que chegam são respondidos em quanto tempo, em média?",
    ],
    5: [
      "O que pesa mais: agenda ociosa, lead que some sem responder, ou paciente que não volta pro pacote?",
      "Quantos orçamentos/avaliações você passa por mês e quantos fecham?",
    ],
    6: ["Quando o paciente 'some', costuma ser depois do orçamento ou antes mesmo de marcar a avaliação?"],
    8: ["Se cada lead virasse avaliação e cada avaliação virasse pacote, quanto a sua agenda encheria?"],
    9: ["Uma sala/cadeira parada num horário nobre, quanto deixa de faturar por mês?"],
  },
  escola: {
    4: [
      "Quantos alunos/turmas hoje e como estão as matrículas por mês? Quem vende — você, secretaria ou professor?",
      "De onde vêm os alunos: indicação, tráfego pago ou orgânico?",
    ],
    5: [
      "O que trava: gerar interessado, converter a visita/aula-teste em matrícula, ou a rematrícula?",
      "Tem meta de matrícula e alguém responsável por bater todo mês?",
    ],
    6: ["Quando o interessado não fecha, o que ele costuma falar — preço, horário, 'vou pensar'?"],
    8: ["Se toda visita virasse matrícula e a rematrícula fosse trabalhada com antecedência, como ficaria sua ocupação?"],
    9: ["Cada turma que não enche, quanto é de mensalidade perdida no ano?"],
  },
  comercio: {
    4: [
      "Quantos vendedores no time e como estão o ticket médio e a taxa de fechamento por vendedor?",
      "Vocês têm meta e acompanham no dia a dia, ou o mês corre solto?",
    ],
    5: [
      "O que trava mais: fluxo de clientes, converter quem entra/manda mensagem, ou o time não seguir processo?",
      "De cada 10 atendimentos, quantos viram venda, mais ou menos?",
    ],
    6: ["Quando o cliente entra (ou chama no WhatsApp) e não compra, o que costuma acontecer no atendimento?"],
    8: ["Se cada vendedor batesse meta com processo e você não precisasse ser a venda da loja, o que mudava na sua rotina?"],
    9: ["A diferença entre o seu melhor e o pior vendedor, multiplicada pelo mês inteiro — quanto você deixa na mesa?"],
  },
};

const questionsFor = (segment: string, phase: number): string[] =>
  OVERRIDES[segment]?.[phase] ?? GENERICO[phase] ?? [];

// Mapeia o campo Segmento (texto livre do lead) para uma das chaves do banco.
const SEGMENT_MATCHERS: { key: string; rx: RegExp }[] = [
  { key: "academia", rx: /academ|studio|st[uú]dio|fitness|crossfit|pilates|muscula|personal|\bbox\b|ginas|yoga/i },
  { key: "clinica", rx: /cl[ií]nic|est[eé]tic|odonto|dent|dermato|sa[uú]de|m[eé]dic|spa|fisio|nutri|harmoniza|capilar|hospital/i },
  { key: "escola", rx: /escola|curso|idioma|col[eé]gio|ensino|educa|faculdade|profissionaliz|prep|vestibular|aula|treinamento/i },
  { key: "comercio", rx: /com[eé]rcio|loja|varejo|vestu[aá]rio|moda|cal[çc]ad|distribuidora|papelaria|semij[oó]ia|joalheria|[oó]tica|perfumaria|autopeça|material|mercado|revend/i },
];

const guessSegment = (raw?: string | null): string => {
  if (!raw) return "generico";
  const found = SEGMENT_MATCHERS.find((m) => m.rx.test(raw));
  return found?.key ?? "generico";
};

export const NEPQQuestionBank = ({ leadSegment }: { leadSegment?: string | null }) => {
  const [segment, setSegment] = useState(() => guessSegment(leadSegment));
  const autoDetected = guessSegment(leadSegment) !== "generico";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Perguntas NEPQ prontas por segmento</h3>
        </div>
        <div className="w-56">
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {autoDetected
          ? "Segmento sugerido pelo cadastro do lead — troque no seletor se preferir. "
          : "Escolha o segmento do cliente no seletor. "}
        Perguntas de referência pra cada fase do NEPQ. Tom curioso e calmo, sem empurrar — deixe o cliente elaborar e adapte às palavras dele.
      </p>
      <Accordion type="multiple" className="w-full">
        {PHASES.map((p) => (
          <AccordionItem key={p.n} value={`nepq-${p.n}`}>
            <AccordionTrigger className="text-xs py-2.5 hover:no-underline">
              <span className="flex items-center gap-2 text-left">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">{p.n}</span>
                {p.name}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pl-7 pr-1">
                {questionsFor(segment, p.n).map((q, i) => (
                  <li key={i} className="text-xs leading-relaxed text-muted-foreground relative before:content-['“'] before:text-primary before:font-bold before:mr-1">
                    {q}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
