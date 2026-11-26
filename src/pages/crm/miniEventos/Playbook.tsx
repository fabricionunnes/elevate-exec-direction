// Playbook do funil de mini-eventos dentro do painel: o conteúdo do PDF "Funil de Mini-Eventos para vender
// o Mastermind Alpha", ajustado pro que foi de fato montado na turma 1 (quinta 10/12, 14h às 21h, Grande BH).
import { useState, type ReactNode } from "react";

const SECOES = [
  ["matematica", "Matemática"], ["cronograma", "Cronograma"], ["promessas", "Promessas"], ["criativos", "Criativos"],
  ["paginas", "Páginas"], ["whatsapp", "WhatsApp"], ["evento", "Dia do evento"], ["pitch", "Pitch e call"],
  ["acompanhamento", "Acompanhamento"], ["plano", "Plano de 90 dias"],
] as const;
type Secao = (typeof SECOES)[number][0];

function Titulo({ n, children, sub }: { n: string; children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#E91D2D]">{n}</div>
      <h2 className="text-xl font-extrabold text-[#082B48]">{children}</h2>
      {sub && <p className="mt-1 max-w-3xl text-sm text-slate-600">{sub}</p>}
    </div>
  );
}
const H3 = ({ children }: { children: ReactNode }) => <h3 className="mb-2 mt-6 text-sm font-extrabold uppercase tracking-wider text-[#082B48]">{children}</h3>;

function Tabela({ cab, linhas, destaque }: { cab: string[]; linhas: ReactNode[][]; destaque?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead><tr className="bg-[#082B48] text-left text-[11px] uppercase tracking-wider text-white">{cab.map((c) => <th key={c} className="px-3 py-2 font-bold">{c}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={`border-t align-top ${destaque === i ? "bg-red-50" : i % 2 ? "bg-slate-50/60" : ""}`}>
              {l.map((c, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? "font-bold text-[#082B48]" : "text-slate-700"}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const Nota = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <div className="mt-4 rounded-xl border-l-4 border-[#E91D2D] bg-white p-4 text-sm leading-relaxed text-slate-700"><b className="text-[#082B48]">{titulo}</b> {children}</div>
);
const Lista = ({ itens, numerada }: { itens: ReactNode[]; numerada?: boolean }) => (
  <ul className="space-y-1.5 text-sm text-slate-700">
    {itens.map((x, i) => (
      <li key={i} className="flex gap-2">
        <span className={`mt-0.5 flex h-5 shrink-0 items-center justify-center rounded text-[11px] font-extrabold ${numerada ? "w-5 bg-[#082B48] text-white" : "w-2"}`}>{numerada ? i + 1 : <span className="h-1.5 w-1.5 rounded-full bg-[#E91D2D]" />}</span>
        <span>{x}</span>
      </li>
    ))}
  </ul>
);
const Cartao = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <div className="rounded-xl border bg-white p-4"><div className="mb-2 text-[12px] font-extrabold uppercase tracking-wider text-[#082B48]">{titulo}</div>{children}</div>
);
const Numero = ({ v, r }: { v: string; r: string }) => (
  <div className="rounded-xl border bg-white p-4"><div className="text-2xl font-extrabold text-[#082B48]">{v}</div><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{r}</div></div>
);
// blocos de página, na ordem em que aparecem na tela
const Blocos = ({ titulo, link, itens }: { titulo: string; link?: string; itens: [string, string][] }) => (
  <div className="rounded-xl border bg-white p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#082B48]">{titulo}</span>
      {link && <a href={link} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-[#E91D2D] underline">abrir</a>}
    </div>
    <div className="space-y-1.5">
      {itens.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-1.5"><div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{k}</div><div className="text-[12.5px] leading-snug text-slate-700">{v}</div></div>
      ))}
    </div>
  </div>
);
const Msg = ({ quando, texto }: { quando: string; texto: string }) => (
  <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-[10px] font-extrabold uppercase tracking-wider text-[#E91D2D]">{quando}</div><div className="mt-0.5 text-[12.5px] leading-snug text-slate-700">{texto}</div></div>
);

const PROMESSAS: [string, string, string][] = [
  ["Planejamento 2027", "Como fazer um planejamento comercial de 2027 que bate meta desde janeiro e acaba com o ano no improviso, mesmo sem contratar consultoria", "Empresa entra o ano sem meta desdobrada"],
  ["Meta todo mês", "Como bater meta nos 12 meses de 2027 e acabar com a montanha-russa do faturamento, mesmo sem aumentar o time", "Faturamento que oscila"],
  ["Dono fora do comercial", "Como tirar o dono do comercial e ver a empresa vender mais, mesmo sem contratar um gerente", "Só o dono vende"],
  ["Previsibilidade", "Como ter previsibilidade de vendas e saber no dia 1 quanto vai faturar no mês, mesmo sem aumentar a verba", "Não sabe quanto vai entrar"],
  ["Time que vende", "Como ter um time de vendas que bate meta sozinho e parar de cobrar todo dia, mesmo sem trocar de vendedor", "Time sem processo"],
  ["Vender mais sem contratar", "Como dobrar a conversão e parar de perder o lead que você já pagou, mesmo sem aumentar a verba", "Lead entra e não fecha"],
  ["IA no comercial", "Como ter um time de IA no comercial que responde todo lead em 1 minuto e acaba com a venda perdida, mesmo sem entender de tecnologia", "Lead sem resposta, follow-up esquecido"],
  ["Diagnóstico", "Como fazer um diagnóstico comercial que mostra onde sua empresa perde venda e recupera esse dinheiro, mesmo sem contratar consultoria", "Não sabe onde está o furo"],
  ["Máquina de vendas", "Como criar uma máquina de vendas que bate meta toda semana, sem depender do dono", "Venda no improviso"],
  ["Sala fechada", "Como 25 empresários de BH vão sair do improviso e montar o comercial de 2027 em uma sala fechada, mesmo sem parar a empresa por mais de uma tarde", "Empresário sozinho, sem referência"],
];
const ANUNCIOS: [string, string][] = [
  ["Empresário de BH: 2027 começa em menos de um mês. Sua meta já está desdobrada?", "Como fazer um planejamento comercial de 2027 que bate meta desde janeiro e acaba com o ano no improviso, mesmo sem contratar consultoria"],
  ["12 meses, 12 metas batidas. É o plano que eu aplico nas empresas que atendo, montado com você em um dia.", "Como bater meta nos 12 meses de 2027 e acabar com a montanha-russa do faturamento, mesmo sem aumentar o time"],
  ["Se você tirar 15 dias de férias, sua empresa vende? Se a resposta é não, o problema não é o time. É processo.", "Como tirar o dono do comercial e ver a empresa vender mais, mesmo sem contratar um gerente"],
  ["Quanto sua empresa vai vender mês que vem? Se você não sabe responder, falta funil.", "Como ter previsibilidade de vendas e saber no dia 1 quanto vai faturar no mês, mesmo sem aumentar a verba"],
  ["Seu vendedor não bate meta. A culpa é dele ou do processo? Na maioria das vezes é do processo que não existe.", "Como ter um time de vendas que bate meta sozinho e parar de cobrar todo dia, mesmo sem trocar de vendedor"],
  ["Você não precisa de mais lead. Precisa converter o que já chega.", "Como dobrar a conversão e parar de perder o lead que você já pagou, mesmo sem aumentar a verba"],
  ["Lead sem resposta é venda perdida. Você monta o seu time de IA pra atender, qualificar e agendar.", "Como ter um time de IA no comercial que responde todo lead em 1 minuto e acaba com a venda perdida, mesmo sem entender de tecnologia"],
  ["Sua empresa está perdendo venda. Você sabe onde?", "Como fazer um diagnóstico comercial que mostra onde sua empresa perde venda e recupera esse dinheiro, mesmo sem contratar consultoria"],
  ["Sistema escala. Improviso não.", "Como criar uma máquina de vendas que bate meta toda semana, sem depender do dono"],
  ["25 empresários. Uma sala. Sete horas de trabalho. Sem palco, sem plateia de 500 pessoas.", "Como 25 empresários de BH vão sair do improviso e montar o comercial de 2027 em uma sala fechada, mesmo sem parar a empresa por mais de uma tarde"],
];

export default function Playbook() {
  const [s, setS] = useState<Secao>("matematica");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 rounded-xl border bg-white p-2">
        {SECOES.map(([k, r], i) => (
          <button key={k} onClick={() => setS(k)} className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors ${s === k ? "bg-[#082B48] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            <span className={s === k ? "text-white/60" : "text-slate-400"}>{String(i + 2).padStart(2, "0")}</span> {r}
          </button>
        ))}
      </div>

      {s === "matematica" && (
        <div>
          <Titulo n="02 · A matemática" sub="Tudo parte do clique. Se a promessa gera clique, gera lead. Se gera lead, gera ingresso. A meta de cada etapa diz onde o funil está quebrando.">Metas por etapa e o caixa da operação</Titulo>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Numero v="1.000" r="Cliques no anúncio" /><Numero v="100" r="Leads na captura (10%)" /><Numero v="25 a 30" r="Ingressos (25 a 30% dos leads)" /><Numero v="70+" r="Leads que sobram pra call" />
          </div>
          <H3>Metas do funil</H3>
          <Tabela cab={["Etapa", "Indicador", "Meta", "Se ficar abaixo"]} linhas={[
            ["Anúncio", "Cliques no link", "1.000 na semana", "Promessa fraca. Troca a promessa, não o público."],
            ["Captura", "Clique que vira lead", "10%", "Formulário longo ou pergunta que assusta. Corta campo."],
            ["Lead", "Custo por lead", "R$ 10 a 30", "Acima de R$ 30, revisa o criativo antes de escalar."],
            ["Página", "Compra direta", "15 a 20% dos leads", "Página sem prova ou checkout travando."],
            ["WhatsApp", "Compra recuperada", "10 a 15% dos leads", "Abordagem lenta. Lead tem que ser chamado em 5 minutos."],
            ["Ingresso", "Pagantes", "25 (meta 30)", "Checagem na noite do dia do pico."],
            ["Evento", "Presença", "80% (20 de 25)", "Reforça a confirmação nos dois dias anteriores."],
          ]} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><H3>Caixa do evento · custo</H3>
              <Tabela cab={["Item", "Valor"]} linhas={[
                ["Teste de promessa (10 × R$ 20 × 2 dias)", "R$ 400"], ["Tráfego de escala (7 dias de venda)", "R$ 1.500 a 2.100"],
                ["Sala", "R$ 500"], ["Coffee, material e crachá (estimativa)", "R$ 600"], ["Total", <b key="t">R$ 3.000 a 3.600</b>],
              ]} /></div>
            <div><H3>Caixa do evento · retorno</H3>
              <Tabela cab={["Item", "Valor"]} linhas={[
                ["25 ingressos × R$ 97", "R$ 2.425"], ["30 ingressos × R$ 97", "R$ 2.910"], ["Saldo do evento antes do pitch", "perto de zero"],
                ["1 Mastermind Alpha fechado", "R$ 1.500/mês"], ["Contrato cheio (12 meses)", "R$ 18.000"], ["Leads que ficam na base", "100+"],
              ]} /></div>
          </div>
          <H3>Cenários de fechamento do Mastermind Alpha</H3>
          <Tabela destaque={1} cab={["Cenário", "Presentes", "Calls agendadas", "Fechamentos", "Receita nova por mês", "Contrato cheio (12 meses)"]} linhas={[
            ["Conservador", "18", "7", "1", "R$ 1.500", "R$ 18 mil"], ["Provável", "20", "10", "2", "R$ 3.000", "R$ 36 mil"], ["Forte", "24", "14", "4", "R$ 6.000", "R$ 72 mil"],
          ]} />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Numero v="R$ 1.500" r="Mensalidade do Mastermind Alpha" /><Numero v="12 meses" r="Contrato, com saída a qualquer momento" /><Numero v="30 dias" r="Aviso prévio pra sair" />
          </div>
          <Nota titulo="O que muda com mensalidade.">O evento não se paga em uma tacada, ele constrói receita recorrente. Com o ingresso cobrindo o tráfego, o saldo de cada turma fica perto de R$ 600 a R$ 1.200 negativos, e a primeira mensalidade de um único fechamento já cobre isso. Como o cliente pode sair com 30 dias de aviso, o valor de 12 meses só existe se ele ficar: permanência média vira o indicador que decide se o funil dá lucro.</Nota>
          <Nota titulo="O que é dado e o que é hipótese.">Os números de cliques, leads, ingressos, curva da semana e verba vêm dos áudios. Preço e condições do Mastermind Alpha são os que você passou. As taxas de agendamento de call e de fechamento são hipóteses pra dimensionar: o primeiro evento serve pra medir as reais.</Nota>
          <H3>Verba diária e trava de risco</H3>
          <Tabela destaque={3} cab={["Dia da venda", "Verba do dia", "Gasto acumulado", "Vendas esperadas", "Receita acumulada", "Decisão"]} linhas={[
            ["1º", "R$ 200", "R$ 200", "2", "R$ 194", "Segue"], ["2º", "R$ 200", "R$ 400", "1", "R$ 291", "Segue"],
            ["3º", "R$ 200", "R$ 600", "0", "R$ 291", "Deserto. Normal. Não mexe."], ["4º · dia da verdade", "R$ 300", "R$ 900", "12", "R$ 1.455", "Zero venda até a noite: encerra."],
            ["5º", "R$ 300", "R$ 1.200", "4", "R$ 1.843", "Reinveste o que entrou"], ["6º", "R$ 300", "R$ 1.500", "6", "R$ 2.425", "Rapa do tacho"],
          ]} />
        </div>
      )}

      {s === "cronograma" && (
        <div>
          <Titulo n="03 · Cronograma" sub="Calendário da turma 1 como ficou montado: evento na quinta 10/12, das 14h às 21h, na Grande BH.">Do primeiro anúncio à primeira call</Titulo>
          <Tabela destaque={6} cab={["Quando", "Fase", "O que acontece", "Dono"]} linhas={[
            ["Até seg 30/11", "Preparação", "Fechar a sala. Recarregar a conta de anúncios. Páginas, checkout de R$ 97 e automação de WhatsApp já estão no ar. 30 anúncios prontos e pausados.", "Fabrício + operação"],
            ["Ter 01 e qua 02/12", "Teste de promessa", "10 conjuntos, R$ 20 por dia cada. Olha só cliques. Na quarta à noite escolhe a vencedora.", "Tráfego"],
            ["Qui 03/12", "Abre a venda", "Desliga as 9 perdedoras. Vencedora a R$ 200 por dia. Lead cai na captura, vai pra página e entra na automação.", "Tráfego + agente"],
            ["Sex 04 a dom 06/12", "Vale", "Poucas ou nenhuma venda. Mantém a verba, mantém a abordagem no WhatsApp. Não troca criativo por ansiedade.", "Agente + SDR"],
            ["Seg 07/12", "Dia da verdade", "Pico de venda. Disparo de últimas vagas pra toda a base de leads, a partir das 8h. Sobe a verba pra R$ 300. Checagem às 21h.", "Todos"],
            ["Ter 08/12", "Indecisos", "Feriado municipal em BH. Mensagem só pra quem abriu o checkout e não pagou, a partir das 10h. Confirmação de presença dos pagantes.", "SDR"],
            ["Qua 09/12", "Rapa do tacho", "Última chamada das 10h às 18h. Às 17h sai local, horário e mapa pros pagantes. Lista de presença impressa.", "SDR + operação"],
            ["Qui 10/12", "Mini-evento", "Workshop das 14h às 21h. Credenciamento às 13h30. Pitch pra call no fim. Agendamento na sala.", "Fabrício + closer"],
            ["Sex 11/12", "Reaquecimento", "A partir das 10h: mensagem pros presentes (marcar a call) e pros leads que não foram (convite de diagnóstico).", "Automação"],
            ["Seg 14 a qua 16/12", "Calls", "Calls de fechamento do Mastermind Alpha. Quem não fecha entra em cadência de 7 dias.", "Fabrício / closer"],
          ]} />
          <Nota titulo="Por que 7 dias.">Prazo curto é o gatilho. "É nesta quinta" vende mais que "é no mês que vem". Evento com 30 dias de antecedência perde a urgência e a venda escorre pra véspera do mesmo jeito.</Nota>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Cartao titulo="Sábado ou meio de semana: é teste">
              <p className="mb-2 text-sm text-slate-700">Os dois funcionam e atraem públicos diferentes. Quem consegue parar a empresa numa tarde de semana costuma ser mais qualificado que o público de sábado.</p>
              <Tabela cab={["Formato", "Horário", "Venda"]} linhas={[["Meio de semana (turma 1, qui 10/12)", "14h às 21h", "Qui a qua"], ["Sábado (turma seguinte)", "9h às 18h", "Dom a sex"]]} />
              <p className="mt-2 text-sm text-slate-700">Compara presença, agendamento de call e fechamento, e fica com o que fechar mais Mastermind.</p>
            </Cartao>
            <Cartao titulo="A regra das 7 horas">
              <p className="mb-2 text-sm text-slate-700">A pessoa precisa de cerca de 7 horas ouvindo você pra decidir comprar algo robusto. O evento existe pra entregar essas 7 horas de uma vez.</p>
              <Lista itens={["Sábado 9h às 18h: 7h de conteúdo, mais almoço e intervalos", "Meio de semana 14h às 21h: 7h corridas com um intervalo", "Dá pra fazer mais curto, mas a conversão pra um contrato de 12 meses cai"]} />
            </Cartao>
          </div>
          <H3>Checklist antes de ligar o tráfego</H3>
          <div className="rounded-xl border bg-white p-4">
            <Lista itens={[
              "Sala reservada pra 30 pessoas, formato escolar ou em U",
              "Checkout de R$ 97 com Pix e cartão, testado com compra real",
              "Página de venda no ar, com pixel e evento de compra disparando",
              "Página de captura com redirecionamento pra página de venda",
              "Captura, CRM e WhatsApp integrados (a primeira mensagem sai em 3 a 5 minutos)",
              "10 promessas aprovadas, cada uma em um conjunto",
              "Sequência de WhatsApp carregada (comprou e não comprou)",
              "Agenda de calls aberta pros três dias depois do evento",
              "Painel de acompanhamento com as metas do dia",
              "Instagram com cases e prova no topo do perfil (o lead vai conferir)",
              "Conta de anúncios com saldo",
              "Local, endereço, mapa e grupo da turma cadastrados (a mensagem da véspera só sai com endereço)",
            ]} />
          </div>
        </div>
      )}

      {s === "promessas" && (
        <div>
          <Titulo n="04 · Promessas" sub="Uma promessa por conjunto. Quem decide a vencedora é o clique, não a nossa opinião. A primeira é a que já validou.">As 10 promessas pro teste</Titulo>
          <Tabela destaque={0} cab={["#", "Ângulo", "Promessa (headline do criativo e da página)", "Dor que ataca", "Página"]} linhas={PROMESSAS.map(([a, p, d], i) => [
            String(i + 1), <span key="a">{a}{i === 0 && <span className="ml-1.5 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">VALIDADA</span>}</span>, p, d,
            <a key="l" href={`/evento/inscricao/?p=${i + 1}`} target="_blank" rel="noreferrer" className="font-bold text-[#E91D2D] underline">?p={i + 1}</a>,
          ])} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Cartao titulo="Como a campanha de teste está montada">
              <Lista itens={["1 campanha, 10 conjuntos, 3 anúncios por conjunto (1 vídeo e 2 imagens)", "Verba no conjunto: R$ 20 por dia cada, por 2 dias", "Mesmo público em todos: Grande BH, raio de 60 km, 25 a 60 anos", "Mesmos 3 criativos em todos, pra testar só a promessa", "Destino: página de captura com a promessa do anúncio", "Tudo manual: sem Advantage+ e sem vários anunciantes"]} />
            </Cartao>
            <Cartao titulo="Como ler o resultado">
              <Lista itens={["Vencedora é a que teve mais cliques no link com o mesmo gasto", "Empate: desempata pelo custo por lead", "Nenhuma passou de 1% de CTR: reescreve as promessas antes de escalar", "Vencedora leva toda a verba. As outras 9 são desligadas", "A headline vencedora vira a headline da página de venda"]} />
            </Cartao>
          </div>
        </div>
      )}

      {s === "criativos" && (
        <div>
          <Titulo n="05 · Criativos" sub="Mesmo esqueleto em todos: gancho com a promessa, data e cidade, preço e botão. Só a promessa muda.">Os criativos do teste</Titulo>
          <div className="grid gap-4 md:grid-cols-3">
            <Cartao titulo="1 · Vídeo do evento"><p className="text-sm text-slate-700">15 segundos da palestra, sem o áudio original e sem legenda. Só a headline da promessa e música de fundo.</p></Cartao>
            <Cartao titulo="2 · Imagem da palestra"><p className="text-sm text-slate-700">Fundo azul da marca com a foto palestrando. Feed e stories.</p></Cartao>
            <Cartao titulo="3 · Imagem clara"><p className="text-sm text-slate-700">Fundo claro, outra foto. Feed e stories.</p></Cartao>
          </div>
          <Nota titulo="Por que os 3 são iguais nas 10 promessas.">É a regra do método: um criativo só, trocando a headline. Assim o que muda de um conjunto pro outro é a promessa, e o clique mede a promessa.</Nota>
          <H3>Texto de cada anúncio</H3>
          <Tabela cab={["#", "Gancho (primeira linha do texto)", "Título do anúncio"]} linhas={ANUNCIOS.map(([g, t], i) => [String(i + 1), g, t])} />
          <p className="mt-2 text-xs text-slate-500">Todos fecham com: quinta 10/12, presencial na Grande BH, 25 vagas, R$ 97. Descrição: "Quinta 10/12 · Grande BH · 25 vagas · R$ 97". Botão: Inscreva-se.</p>
          <Nota titulo="Regras fixas em todo criativo.">Data e cidade aparecem nos 3 primeiros segundos. Preço aparece, porque R$ 97 é argumento e não objeção. Botão único: "Inscreva-se". Nos depoimentos e números, usar só case real e autorizado.</Nota>
          <Nota titulo="Na fase de escala.">A promessa vencedora ganha uma versão em vídeo selfie de 30 segundos, câmera parada, sem música. Os roteiros das promessas 1, 3 e 5 já estão escritos.</Nota>
        </div>
      )}

      {s === "paginas" && (
        <div>
          <Titulo n="06 · Páginas" sub="A captura vem antes da página de venda de propósito: o lead fica registrado mesmo que não compre. É isso que transforma o risco em risco calculado.">Captura, página de venda, checkout e obrigado</Titulo>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Blocos titulo="1 · Captura" link="/evento/inscricao/?p=1" itens={[
              ["Abertura", "Promessa do anúncio clicado. Quinta 10/12 · Grande BH · 25 vagas"], ["Passo 1", "Nome · WhatsApp · E-mail"],
              ["Passo 2 · pergunta 1", "Faturamento mensal: até 50 mil · 50 a 150 mil · 150 a 500 mil · acima de 500 mil"], ["Pergunta 2", "Quantos vendedores: só eu · 1 a 3 · 4 a 10 · mais de 10"],
              ["Pergunta 3", "Maior desafio comercial hoje (aberta curta)"], ["Final", "\"Falta um passo: garanta sua vaga.\" Leva pra página de venda"],
            ]} />
            <Blocos titulo="2 · Página de venda" link="/evento/" itens={[
              ["Dobra 1", "Promessa no formato \"como... sem...\". Workshop presencial com Fabrício Nunnes. Quinta 10/12, 14h às 21h. Botão de R$ 97"], ["Barra fixa", "Contagem até o fim da venda. Vagas restantes só aparecem abaixo de 10"],
              ["Pra quem é", "Dono de empresa com pelo menos 1 vendedor, faturando acima de R$ 50 mil por mês"], ["O que você leva", "4 entregas do dia, cada uma um documento preenchido"],
              ["Agenda", "Diagnóstico e meta, depois funil e time"], ["Quem conduz", "Foto, bio curta, números. Link do Instagram"],
              ["Prova", "Cases com resultado em número"], ["Oferta", "R$ 97 · coffee incluso · 25 vagas"], ["Dúvidas", "Local, estacionamento, nota fiscal, pode levar sócio"],
            ]} />
            <Blocos titulo="3 · Checkout" link="/evento/checkout/" itens={[
              ["Resumo", "Workshop 10/12 · R$ 97"], ["Dados", "Nome · CPF ou CNPJ · WhatsApp, já preenchidos da captura"],
              ["Pagamento", "Pix pelo Asaas (padrão) · cartão em até 3x pelo Mercado Pago"], ["Abandono", "Abriu e não pagou: entra na lista de checkout aberto e recebe a mensagem dos indecisos"],
            ]} />
            <Blocos titulo="4 · Obrigado" link="/evento/obrigado/" itens={[
              ["Confirmação", "Sua vaga está garantida. Quinta 10/12, 14h. Chegue 13h30"], ["Passo 1", "Entrar no grupo de WhatsApp da turma"],
              ["Passo 2", "Adicionar na agenda"], ["Passo 3", "Responder as perguntas de pré-diagnóstico. O material sai personalizado no dia"],
              ["Bônus", "Traga seu sócio por + R$ 47 (aumenta ticket e presença)"], ["Local", "Endereço, mapa e estacionamento"],
            ]} />
          </div>
          <H3>Variações de página pra teste</H3>
          <Tabela cab={["Teste", "Versão A (controle)", "Versão B", "Métrica que decide"]} linhas={[
            ["Headline", "Promessa vencedora do teste de cliques", "Segunda colocada do teste de cliques", "Compra por visita"],
            ["Dobra 1", "Texto + foto do Fabrício", "Vídeo de 60s do Fabrício convidando", "Clique no botão"],
            ["Escassez", "Contagem de tempo até o fim da venda", "Contagem de vagas restantes", "Compra por visita"],
            ["Oferta", "R$ 97 individual", "R$ 97 individual + sócio por R$ 47", "Receita por comprador"],
            ["Comprimento", "Página completa (10 blocos)", "Página curta: promessa, prova, oferta", "Compra por visita"],
          ]} />
          <Nota titulo="Ordem dos testes.">Com 100 visitas na semana não dá pra rodar cinco testes ao mesmo tempo. Turma 1 só o de headline. Um teste novo por turma, o vencedor vira o controle da próxima.</Nota>
        </div>
      )}

      {s === "whatsapp" && (
        <div>
          <Titulo n="07 · Automação" sub="A maior parte dos ingressos sai daqui. A página vende 15 a 20%. O resto é gente sendo chamada, uma a uma, até decidir.">Sequências de WhatsApp</Titulo>
          <Nota titulo="Como roda.">As mensagens saem pelo número Fabrício Nunnes, das 8h às 21h, conferidas de 2 em 2 minutos. Cada pessoa recebe cada mensagem uma vez só. O link sempre abre a página com a promessa do anúncio em que ela clicou. Quem responde sai da sequência e passa a conversar com o agente.</Nota>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Cartao titulo="Trilha A · Preencheu e não comprou">
              <div className="space-y-2">
                <Msg quando="3 a 5 minutos depois · automática" texto="Fulano, aqui é do time do Fabrício Nunnes. Vi sua inscrição no workshop de quinta, dia 10/12, na Grande BH. A vaga fica garantida com o ingresso, e o link pra garantir a sua é este: [link]. Ficou alguma dúvida? Pode me perguntar por aqui." />
                <Msg quando="4 horas depois · quem não respondeu" texto="Fulano, vi que você respondeu que seu maior desafio hoje é: [resposta do formulário]. É exatamente o que a gente trabalha no workshop de quinta. Quer que eu te mande o link da vaga?" />
                <Msg quando="Dia seguinte" texto="Fulano, só pra você ter clareza do que leva pronto na quinta: raio-x comercial da sua empresa, mapa de metas de 2027, funil desenhado e rotina do time. São 25 vagas e a turma é única. Garante a sua aqui: [link]" />
                <Msg quando="Seg 07/12, 8h · toda a base" texto="Fulano, abrimos hoje as últimas vagas do workshop de quinta, dia 10/12, na Grande BH. Quem entra hoje ainda pega lugar na mesa. Garante a sua: [link]" />
                <Msg quando="Ter 08/12, 10h · só checkout aberto" texto="Fulano, vi que você chegou a abrir o pagamento do workshop e não concluiu. Consigo segurar sua vaga até hoje às 18h. Quer fechar no Pix? [link do checkout]" />
                <Msg quando="Qua 09/12, 10h às 18h · última chamada" texto="Fulano, fecho a lista do workshop hoje às 18h pra imprimir o material. Depois disso não consigo incluir. Ainda quer ir? [link]" />
              </div>
            </Cartao>
            <Cartao titulo="Trilha B · Comprou">
              <div className="space-y-2">
                <Msg quando="Na hora do pagamento" texto="Vaga confirmada, Fulano. Quinta, 10/12, das 14h às 21h, na Grande BH. O endereço, o mapa e o grupo da turma chegam por aqui antes do evento. Pra eu preparar seu material: se você pudesse resolver uma coisa só no seu comercial nesse dia, qual seria?" />
                <Msg quando="Qua 09/12, 17h · véspera" texto="Fulano, é amanhã. Quinta, 10/12, das 14h às 21h. Local: [local, endereço]. Mapa: [link]. O credenciamento abre 30 minutos antes. Traz notebook ou caderno e os números do seu comercial. Confirma presença com um OK?" />
                <Msg quando="Qui 10/12, 9h · no dia" texto="Bom dia, Fulano. É hoje. O credenciamento abre às 13h30 e a gente começa às 14h em ponto. Te espero lá." />
              </div>
              <p className="mt-2 text-xs font-semibold text-red-700">A mensagem da véspera só sai se o endereço do local estiver cadastrado na turma.</p>
            </Cartao>
            <Cartao titulo="Trilha C · Pós-evento (sex 11/12, 10h)">
              <div className="space-y-2">
                <Msg quando="Presentes" texto="Fulano, foi muito bom ter você no workshop. Quero olhar com você o plano que montou e definir os próximos passos. Qual o melhor horário pra uma conversa de 40 minutos com o Fabrício essa semana?" />
                <Msg quando="Leads que não foram" texto="Fulano, vi que você se inscreveu no workshop e não conseguiu ir. Qual tem sido sua maior dificuldade no comercial hoje? Se fizer sentido, a gente marca 30 minutos essa semana pra olhar isso." />
                <Msg quando="Pagou e faltou" texto="Fulano, senti sua falta no workshop. Sua vaga vale pra próxima turma. Enquanto isso, quer que a gente olhe seu comercial em uma conversa rápida essa semana?" />
              </div>
            </Cartao>
          </div>
          <H3>Regras de segurança</H3>
          <div className="rounded-xl border bg-white p-4">
            <Lista itens={[
              "Quem já respondeu sai das mensagens de venda. A conversa passa a ser do agente.",
              "Quem já tem conversa recente com você nesse número (últimos 45 dias) não recebe mensagem automática de venda. Fica na fila do painel pra abordagem manual.",
              "Perdido e Fora do perfil não recebem nada.",
              "No máximo 8 mensagens a cada 2 minutos, com intervalo entre elas.",
              "A lista de presença do painel é o que separa \"esteve no evento\" de \"pagou e faltou\": precisa estar marcada no dia.",
            ]} />
          </div>
        </div>
      )}

      {s === "evento" && (
        <div>
          <Titulo n="08 · O dia do evento" sub="São 7 horas de conteúdo, na ordem do Método CRESCER. Cada bloco termina com um documento preenchido, e é esse documento que o empresário leva pra call.">Roteiro do dia</Titulo>
          <H3>Quinta 10/12 · 14h às 21h (roteiro do playbook encaixado no horário da tarde, horários a confirmar)</H3>
          <Tabela destaque={8} cab={["Horário", "Bloco", "O que acontece", "Entregável na mão"]} linhas={[
            ["13h30", "Credenciamento", "Crachá, café, mesa já com o material. Closer circula e conhece cada um.", "Ficha de pré-diagnóstico impressa"],
            ["14h00", "Abertura", "Quem é o Fabrício, cases, regra do dia: ninguém sai sem plano.", ""],
            ["14h30", "Cenário", "Diagnóstico comercial ao vivo. Cada um calcula conversão, ticket e CAC da própria empresa.", "Raio-x comercial"],
            ["15h45", "Resultado ideal", "Meta de 2027 desdobrada por mês, por canal e por vendedor.", "Mapa de metas 2027"],
            ["17h00", "Intervalo", "Coffee juntos. Conversa de mesa vale tanto quanto o conteúdo.", ""],
            ["17h30", "Estrutura e captação", "Funil, canais e rotina do time. Onde entra a IA.", "Funil desenhado"],
            ["18h45", "Conversão", "Script, follow-up e ritual de gestão. Roleplay rápido com dois voluntários.", "Rotina semanal do time"],
            ["19h45", "Cases", "Dois membros do Mastermind contam o antes e depois (ao vivo ou vídeo).", ""],
            ["20h15", "Pitch pra call", "\"O plano está pronto. O que falta é executar com alguém cobrando.\"", "Agendamento por QR code"],
            ["20h45", "Encerramento", "Foto da turma, agendamento na mesa do closer pra quem não escaneou.", ""],
          ]} />
          <H3>Versão de sábado · 9h às 18h (roteiro original do playbook)</H3>
          <Tabela cab={["Horário", "Bloco", "Entregável na mão"]} linhas={[
            ["8h30", "Credenciamento", "Ficha de pré-diagnóstico impressa"], ["9h00", "Abertura", ""], ["9h30", "Cenário", "Raio-x comercial"], ["11h00", "Resultado ideal", "Mapa de metas 2027"],
            ["12h30", "Almoço juntos", ""], ["14h00", "Estrutura e captação", "Funil desenhado"], ["15h30", "Conversão", "Rotina semanal do time"], ["16h45", "Cases", ""],
            ["17h15", "Pitch pra call", "Agendamento por QR code"], ["17h45", "Encerramento", ""],
          ]} />
        </div>
      )}

      {s === "pitch" && (
        <div>
          <Titulo n="08 · O pitch e a call">Do palco pra conversa individual</Titulo>
          <div className="grid gap-4 lg:grid-cols-3">
            <Cartao titulo="Estrutura do pitch (15 minutos)">
              <Lista numerada itens={[
                "Recapitula o que cada um construiu no dia. O plano existe.",
                "Mostra o que acontece com plano sem acompanhamento: volta pra gaveta em 3 semanas.",
                "Apresenta o Mastermind Alpha em 3 linhas: quem está, o que acontece, o que muda.",
                "Não fala preço no palco. \"Não é pra todo mundo, por isso é por conversa.\"",
                "Convite: 40 minutos com o Fabrício, essa semana, pra revisar o plano e ver se faz sentido.",
                "Escassez real: a turma fecha em 60 membros. \"Restam X vagas.\" QR code na tela.",
              ]} />
            </Cartao>
            <Cartao titulo="Por que call e não venda no palco">
              <Lista itens={[
                "Compromisso de 12 meses pede conversa individual, mesmo a R$ 1.500 por mês",
                "O lead chega na call com consciência alta e autoridade já construída, a call só organiza a decisão",
                "Quem não está pronto não trava a sala nem contamina quem está",
                "Agendamento na sala é o indicador do evento: meta de 50% dos presentes",
              ]} />
            </Cartao>
            <Cartao titulo="Roteiro da call (40 minutos)">
              <Lista numerada itens={[
                "Abre no plano que ele montou no evento",
                "Acha o gargalo que ele não resolve sozinho",
                "Mostra como o Alpha ataca esse gargalo",
                "Proposta: R$ 1.500 por mês, 12 meses, sai quando quiser com 30 dias de aviso",
                "Prazo de decisão de 48h",
              ]} />
            </Cartao>
          </div>
        </div>
      )}

      {s === "acompanhamento" && (
        <div>
          <Titulo n="09 · Acompanhamento" sub="Cada etapa do funil vira um evento registrado, e o painel compara o realizado com a meta.">O que este painel registra</Titulo>
          <Tabela cab={["Evento", "Quando dispara", "De onde vem", "Meta da turma"]} linhas={[
            ["Clique no anúncio", "Clique no link do anúncio", "Meta Ads, lido de 4 em 4 minutos", "1.000"],
            ["Lead criado", "Captura enviada", "Página de captura", "100"],
            ["Página vista", "Lead abre a página de venda", "Página de venda", "90"],
            ["Checkout iniciado", "Cobrança gerada", "Checkout", "45"],
            ["Ingresso pago", "Pagamento aprovado", "Asaas e Mercado Pago, conferidos de 2 em 2 minutos", "25"],
            ["WhatsApp abordado", "Primeira mensagem enviada", "Automação no número Fabrício Nunnes", "100% em 5 min"],
            ["WhatsApp respondeu", "Lead responde", "Conversa do CRM", "50%"],
            ["Presença", "Check-in na porta", "Lista de presença deste painel", "20"],
            ["Call agendada", "Horário marcado", "Etapa do funil no CRM", "10"],
            ["Call realizada", "Call aconteceu", "Etapa do funil no CRM", "8"],
            ["Mastermind fechado", "Contrato assinado", "Etapa do funil no CRM", "2"],
          ]} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Cartao titulo="Alertas automáticos">
              <Lista itens={["Lead há mais de 5 minutos sem abordagem", "Custo por lead acima de R$ 30", "Checkout aberto há mais de 2 horas sem pagamento", "Dia do pico às 21h com zero venda: alerta de encerrar a campanha", "Gasto acumulado passou do teto de R$ 2.500"]} />
            </Cartao>
            <Cartao titulo="Indicadores que ficam pra próxima turma">
              <Lista itens={["CAC do ingresso e CAC do Mastermind", "Taxa de presença, de agendamento e de fechamento", "Receita por lead gerado", "Permanência média e cancelamento no Mastermind", "Promessa e criativo campeões"]} />
            </Cartao>
          </div>
          <Nota titulo="Filtro de decisão.">Escala: o funil é o mesmo em qualquer cidade. Previsibilidade: metas por etapa e curva de venda conhecida. Margem: o ingresso paga a aquisição, a mensalidade do Mastermind entra quase limpa e recorrente. Dependência: hoje o palco é o Fabrício, o resto já nasce delegável.</Nota>
        </div>
      )}

      {s === "plano" && (
        <div>
          <Titulo n="10 · Plano de 90 dias" sub="Dois a três eventos por mês, alternando sábado e meio de semana. A turma do Mastermind Alpha fecha em 60 membros, o que dá teto de R$ 90 mil de receita mensal.">Oito eventos em três meses pra encher a turma de 60</Titulo>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Numero v="8" r="Eventos em 3 meses" /><Numero v="60" r="Teto de membros da turma" /><Numero v="R$ 90 mil" r="Receita mensal com turma cheia" /><Numero v="7 a 8" r="Fechamentos por evento pra lotar em 8" />
          </div>
          <H3>Calendário sugerido</H3>
          <Tabela destaque={0} cab={["#", "Data", "Formato", "Promessa", "O que se testa"]} linhas={[
            ["1", "Qui 10/12", "14h às 21h", "Vencedora do teste das 10", "Promessa e funil inteiro"],
            ["2", "Qua 16/12", "14h às 21h", "Mesma vencedora", "Sábado contra meio de semana"],
            ["3", "Qua 13/01", "14h às 21h", "Vencedora + 3 desafiantes", "Promessa de início de ano"],
            ["4", "Sáb 23/01", "9h às 18h", "Campeã de janeiro", "Headline da página"],
            ["5", "Sáb 30/01", "9h às 18h", "Campeã de janeiro", "Oferta do sócio"],
            ["6", "Sáb 13/02", "9h às 18h", "Vencedora + 3 desafiantes", "Promessa sem o gancho \"2027\""],
            ["7", "Sáb 20/02", "9h às 18h", "Campeã de fevereiro", "Vídeo na dobra 1"],
            ["8", "Qua 24/02", "14h às 21h", "Campeã de fevereiro", "Página curta"],
          ]} />
          <Nota titulo="Atenção nas datas.">As datas de 2 a 8 são as do playbook, escritas quando a turma 1 era no sábado 05/12. Como a turma 1 passou pra quinta 10/12, o evento 2 em 16/12 cairia na semana das calls e teria que vender junto com a turma 1: vale empurrar pra janeiro. O teste de sábado contra meio de semana também inverte, já que a turma 1 virou meio de semana.</Nota>
          <Nota titulo="Datas evitadas.">Semana de Natal e Ano Novo, primeira semana de janeiro e o Carnaval (terça 09/02). O gancho "planejamento 2027" perde força a partir de fevereiro, por isso o evento 6 reabre o teste de promessa.</Nota>
          <H3>Quantos membros em 90 dias</H3>
          <Tabela destaque={1} cab={["Cenário", "Fechamentos por evento", "Membros após 8 eventos", "Receita mensal", "Turma ocupada"]} linhas={[
            ["Conservador", "1", "8", "R$ 12 mil", "13%"], ["Provável", "2", "16", "R$ 24 mil", "27%"], ["Forte", "4", "32", "R$ 48 mil", "53%"], ["Pra lotar", "7 a 8", "60", "R$ 90 mil", "100%"],
          ]} />
          <Nota titulo="A conta não fecha só com a call.">Com 20 presentes por evento, lotar 60 em 8 eventos pede fechar mais de um terço da sala. No cenário provável a turma chega a 16. Os números não contam cancelamentos nem membros que já estejam na turma. Pra acelerar existem três alavancas.</Nota>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Cartao titulo="1 · Oferta na sala"><p className="text-sm text-slate-700">A R$ 1.500 por mês com saída livre, dá pra fechar no evento, no pico de confiança. A call fica pra quem não decidiu. É a alavanca que mais mexe no número.</p></Cartao>
            <Cartao titulo="2 · Os leads que sobram"><p className="text-sm text-slate-700">Cada evento deixa cerca de 70 leads que não compraram ingresso. Em 8 eventos são mais de 500 empresários pro SDR chamar pra call de diagnóstico.</p></Cartao>
            <Cartao titulo="3 · Sala maior"><p className="text-sm text-slate-700">Com a promessa validada, subir a meta de 25 pra 40 ingressos por evento. A verba sobe na mesma proporção e o ingresso continua pagando o tráfego.</p></Cartao>
          </div>
          <H3>O que muda na operação com 2 a 3 eventos por mês</H3>
          <div className="rounded-xl border bg-white p-4">
            <Lista itens={[
              "Teste das 10 promessas só no evento 1. Depois roda a campeã e testa 3 desafiantes a cada três eventos",
              "Página, captura e automação viram modelo: só troca data e local",
              "Um evento por vez em venda, pra as campanhas não disputarem o mesmo público de BH",
              "Fabrício no palco 2 a 3 dias por mês. As calls passam pra um closer a partir do evento 3",
              "SDR dedicado ao WhatsApp nas semanas de venda",
              "Caixa de tráfego pra 8 eventos: R$ 15 a 20 mil, recuperados nos ingressos",
            ]} />
          </div>
        </div>
      )}
    </div>
  );
}
