// Desenho do funil de mini-eventos em fluxograma, com o número ao vivo dentro de cada caixa.
// Segue a página "O desenho" do playbook: teste de promessa, venda do ingresso, evento e Mastermind Alpha.
import type { CSSProperties, ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

export interface DesenhoDados {
  cidade: string; dataEv: string; horario: string; preco: number; vagas: number;
  cliques: number; gasto: number; receita: number; leads: number; pagina: number; checkout: number; ingressos: number; presentes: number;
  semAbordagem: number; naoComprou: number; pagouFaltou: number; presencaConfirmada: number;
  callsAgendadas: number; callsRealizadas: number; fechados: number;
  metas: Record<string, number>;
  vencedora: string | null; conjuntos: number; anuncios: number;
  dias: { ymd: string; rotulo: string; vendas: number; ref: number | null }[]; maxDia: number;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const taxa = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : null);

type Tom = "navy" | "vermelho" | "verde" | "claro" | "cinza";
const TOM: Record<Tom, string> = {
  navy: "bg-[#082B48] border-[#082B48] text-white",
  vermelho: "border-[#E91D2D] text-white",
  verde: "bg-green-600 border-green-600 text-white",
  claro: "bg-white border-[#082B48] text-[#082B48]",
  cinza: "bg-slate-50 border-slate-300 border-dashed text-slate-700",
};

function No({ titulo, sub, valor, meta, tom = "claro", pos, passo }: {
  titulo: string; sub?: ReactNode; valor?: number | string; meta?: number | string; tom?: Tom; pos?: CSSProperties; passo?: number;
}) {
  const escuro = tom === "navy" || tom === "vermelho" || tom === "verde";
  return (
    <div className={`relative rounded-xl border-2 p-3 shadow-sm ${TOM[tom]}`}
      style={{ ...pos, ...(tom === "vermelho" ? { background: "linear-gradient(180deg,#E91D2D,#CC572D)" } : {}) }}>
      {passo !== undefined && (
        <span className={`absolute -top-2.5 -left-2.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${escuro ? "bg-white text-[#082B48]" : "bg-[#082B48] text-white"}`}>{passo}</span>
      )}
      <div className="text-[13px] font-extrabold uppercase tracking-wide leading-tight">{titulo}</div>
      {valor !== undefined && (
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold tabular-nums leading-none">{typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor}</span>
          {meta !== undefined && <span className={`text-xs font-semibold ${escuro ? "text-white/70" : "text-slate-400"}`}>/ {typeof meta === "number" ? meta.toLocaleString("pt-BR") : meta}</span>}
        </div>
      )}
      {sub && <div className={`mt-1.5 text-[11.5px] leading-snug ${escuro ? "text-white/85" : "text-slate-600"}`}>{sub}</div>}
    </div>
  );
}

function Seta({ dir = "direita", rotulo, real, pos }: { dir?: "direita" | "baixo" | "cima"; rotulo?: string; real?: string | null; pos?: CSSProperties }) {
  const Icone = dir === "direita" ? ArrowRight : dir === "baixo" ? ArrowDown : ArrowUp;
  return (
    <div className={`flex items-center justify-center gap-1 ${dir === "direita" ? "flex-col" : "flex-row py-1"}`} style={pos}>
      {dir === "direita" && real && <span className="text-[11px] font-extrabold text-[#082B48] tabular-nums">{real}</span>}
      <Icone className="h-6 w-6 text-[#E91D2D] shrink-0" strokeWidth={3} />
      {(rotulo || (dir !== "direita" && real)) && (
        <span className="text-center text-[10.5px] font-semibold leading-tight text-slate-500">
          {rotulo}{dir !== "direita" && real ? <b className="block text-[#082B48]">{real}</b> : null}
        </span>
      )}
    </div>
  );
}

function Fase({ numero, titulo, quando, children }: { numero: number; titulo: string; quando: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <span className="rounded-md bg-[#082B48] px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">Fase {numero}</span>
        <h2 className="text-base font-extrabold uppercase tracking-wide text-[#082B48]">{titulo}</h2>
        <span className="text-xs font-semibold text-slate-500">{quando}</span>
      </header>
      <div className="overflow-x-auto p-4">{children}</div>
    </section>
  );
}

const COLS = "minmax(150px,1fr) 64px minmax(150px,1fr) 64px minmax(150px,1fr) 64px minmax(150px,1fr) 64px minmax(150px,1fr)";
const em = (col: string, lin: number): CSSProperties => ({ gridColumn: col, gridRow: lin });

export default function FunilDesenho({ d }: { d: DesenhoDados }) {
  const m = d.metas || {};
  const abordados = Math.max(0, d.leads - d.semAbordagem);
  const sobraram = Math.max(0, d.leads - d.ingressos);
  const pico = d.dias.reduce((m, x, i) => ((x.ref || 0) > (d.dias[m]?.ref || 0) ? i : m), 0);
  return (
    <div className="space-y-5">
      {/* Fase 1 */}
      <Fase numero={1} titulo="Teste de promessa" quando="2 dias · ter 01 e qua 02/12">
        <div className="grid items-center gap-y-2" style={{ gridTemplateColumns: COLS, minWidth: 1010 }}>
          <No passo={1} tom="navy" pos={em("1", 1)} titulo="10 promessas" valor={d.conjuntos || 10} meta="conjuntos"
            sub={<>{d.anuncios || 30} anúncios, 3 por promessa (1 vídeo e 2 imagens). R$ 20 por dia cada, mesmo público.</>} />
          <Seta pos={em("2", 1)} rotulo="roda 2 dias" />
          <No passo={2} pos={em("3", 1)} titulo="O clique decide" valor={d.cliques} meta={m.cliques}
            sub="Métrica única: clique no link. Sem clique não tem lead. Empate desempata no custo por lead." />
          <Seta pos={em("4", 1)} rotulo="mais clique ganha" />
          <No passo={3} tom="vermelho" pos={em("5", 1)} titulo="Promessa vencedora"
            sub={d.vencedora ? <><b>Na frente agora:</b> {d.vencedora}</> : "Ainda sem clique. Aparece aqui a que estiver na frente."} />
          <Seta pos={em("6", 1)} rotulo="desliga as outras 9" />
          <No passo={4} pos={em("7", 1)} titulo="Escala" valor={brl(d.gasto)} meta="R$ 2,5 mil de teto"
            sub="A vencedora leva toda a verba: R$ 200 a 300 por dia até a véspera. A headline dela vira a headline da página." />
          <Seta pos={em("8", 1)} rotulo="alimenta a fase 2" />
          <No tom="cinza" pos={em("9", 1)} titulo="A matemática"
            sub={<><b>1.000</b> cliques<br /><b>100</b> leads (10%)<br /><b>25 a 30</b> ingressos (25 a 30% dos leads)<br /><b>70+</b> leads sobram pra call</>} />
        </div>
      </Fase>

      {/* Fase 2 */}
      <Fase numero={2} titulo="Captação e venda do ingresso" quando="7 dias · qui 03 a qua 09/12, 18h">
        <div className="grid items-center gap-y-1" style={{ gridTemplateColumns: COLS, minWidth: 1010 }}>
          <No passo={1} tom="navy" pos={em("1", 1)} titulo="Anúncio no Meta" valor={d.cliques} meta={m.cliques}
            sub={<>Empresários da {d.cidade}, raio de 60 km. Cliques no link.</>} />
          <Seta pos={em("2", 1)} real={taxa(d.leads, d.cliques)} rotulo="meta 10%" />
          <No passo={2} pos={em("3", 1)} titulo="Página de captura" valor={d.leads} meta={m.leads}
            sub="Formulário em 2 passos, com a promessa do anúncio que a pessoa clicou. O lead fica registrado mesmo sem comprar." />
          <Seta pos={em("4", 1)} real={taxa(d.pagina, d.leads)} rotulo="meta 90%" />
          <No passo={3} pos={em("5", 1)} titulo={`Página de venda · ${brl(d.preco)}`} valor={d.pagina} meta={m.pagina}
            sub="15 a 20% dos leads compram direto aqui." />
          <Seta pos={em("6", 1)} real={taxa(d.checkout, d.pagina)} rotulo="meta 50%" />
          <No passo={4} pos={em("7", 1)} titulo="Checkout" valor={d.checkout} meta={m.checkout}
            sub="Pix pelo Asaas e cartão em até 3x pelo Mercado Pago." />
          <Seta pos={em("8", 1)} real={taxa(d.ingressos, d.leads)} rotulo="meta 25% dos leads" />
          <No passo={5} tom="verde" pos={em("9", 1)} titulo="Ingresso pago" valor={d.ingressos} meta={m.ingressos ?? d.vagas}
            sub={<>{brl(d.receita)} de volta. O ingresso paga o tráfego.</>} />

          <Seta dir="baixo" pos={em("5", 2)} rotulo="80 a 85% não compram na hora" />
          <Seta dir="cima" pos={em("7", 2)} rotulo="recupera a venda" />
          <Seta dir="cima" pos={em("9", 2)} rotulo="confirmação na hora" />

          <No passo={6} tom="vermelho" pos={em("3 / 8", 3)} titulo="WhatsApp · automação e agente" valor={abordados} meta={`${d.leads} leads abordados`}
            sub={<>Primeira mensagem sai sozinha em 3 a 5 minutos, pelo número Fabrício Nunnes, já com o link da vaga. Depois: 4 horas, dia seguinte, últimas vagas, checkout aberto e última chamada. Quem responde passa pro agente. {d.semAbordagem > 0 && <b>{d.semAbordagem} na fila sem abordagem.</b>}</>} />
          <Seta pos={em("8", 3)} rotulo="não comprou" />
          <No tom="cinza" pos={em("9", 3)} titulo="Leads que sobraram" valor={sobraram} meta="70+"
            sub={<>Convite direto pra call de diagnóstico no dia seguinte ao evento. {d.naoComprou > 0 && <b>{d.naoComprou} já na etapa.</b>}</>} />
        </div>

        {/* Semana de vendas */}
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]" style={{ minWidth: 1010 }}>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#082B48]">A semana de vendas · o dia em vermelho é o dia da verdade</div>
            <div className="mt-2 flex h-28 items-end gap-2">
              {d.dias.map((x, i) => (
                <div key={x.ymd} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs font-extrabold tabular-nums text-[#082B48]">{x.vendas}<span className="font-semibold text-slate-400">{x.ref !== null ? ` / ${x.ref}` : ""}</span></span>
                  <div className="relative flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-md bg-slate-200" style={{ height: `${((x.ref || 0) / d.maxDia) * 100}%` }} />
                    <div className="absolute bottom-0 left-0 right-0 rounded-t-md" style={{ height: `${(x.vendas / d.maxDia) * 100}%`, background: "linear-gradient(180deg,#E91D2D,#CC572D)" }} />
                  </div>
                  <span className={`text-[10.5px] font-semibold ${i === pico ? "text-[#E91D2D]" : "text-slate-500"}`}>{x.rotulo}</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">Vermelho: vendas reais. Cinza: curva de referência do método, com o pico 3 dias antes do evento. O resto até 25 entra na rapa do tacho.</p>
          </div>
          <div className="rounded-xl border-2 border-dashed border-[#E91D2D] p-3 text-[12px] leading-snug text-slate-700">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#E91D2D]">Risco calculado</div>
            <p className="mt-1">Antes do pico, até R$ 800 queimados. Cada venda devolve R$ 97 pro tráfego.</p>
            <p className="mt-1"><b>O dia do pico fechou sem venda?</b> Encerra a campanha e trabalha os leads pra call.</p>
          </div>
        </div>
      </Fase>

      {/* Fase 3 */}
      <Fase numero={3} titulo="O evento e a venda do Mastermind Alpha" quando={`qui ${d.dataEv} · ${d.horario} · calls de seg 14 a qua 16/12`}>
        <div className="grid items-center gap-y-1" style={{ gridTemplateColumns: COLS, minWidth: 1010 }}>
          <No passo={1} pos={em("1", 1)} titulo="Presença confirmada" valor={d.presencaConfirmada} meta={d.ingressos}
            sub="Véspera às 17h: endereço, mapa e pedido de OK. No dia às 9h: lembrete." />
          <Seta pos={em("2", 1)} rotulo="meta 80% presentes" />
          <No passo={2} tom="navy" pos={em("3", 1)} titulo="Mini-evento · 7 horas" valor={d.presentes} meta={m.presentes}
            sub={<>Workshop na {d.cidade}. Autoridade empilhada o dia inteiro. Cada bloco termina com um documento preenchido.</>} />
          <Seta pos={em("4", 1)} real={taxa(d.callsAgendadas, d.presentes)} rotulo="meta 50%" />
          <No passo={3} pos={em("5", 1)} titulo="Pitch pra call" valor={d.callsAgendadas} meta={m.calls_agendadas}
            sub="No fim do dia. Agenda na hora, na sala, com QR code. Não vende no palco, não fala preço." />
          <Seta pos={em("6", 1)} real={taxa(d.callsRealizadas, d.callsAgendadas)} rotulo="meta 80%" />
          <No passo={4} pos={em("7", 1)} titulo="Call de fechamento" valor={d.callsRealizadas} meta={m.calls_realizadas}
            sub="40 minutos. O lead chega com consciência alta. Prazo de decisão de 48h." />
          <Seta pos={em("8", 1)} real={taxa(d.fechados, d.callsRealizadas)} rotulo="meta 25%" />
          <No passo={5} tom="verde" pos={em("9", 1)} titulo="Mastermind Alpha" valor={d.fechados} meta={m.fechamentos}
            sub={<>R$ 1.500 por mês, 12 meses, sai com 30 dias de aviso. {brl(d.fechados * 1500)} de receita nova por mês.</>} />

          <Seta dir="baixo" pos={em("1", 2)} rotulo="não apareceu" />
          <Seta dir="baixo" pos={em("3", 2)} rotulo="dia seguinte, 10h" />
          <Seta dir="baixo" pos={em("7", 2)} rotulo="não fechou" />

          <No tom="cinza" pos={em("1", 3)} titulo="Pagou e faltou" valor={d.pagouFaltou}
            sub="A vaga vale pra próxima turma. Oferta de uma conversa rápida sobre o comercial." />
          <No tom="cinza" pos={em("3 / 6", 3)} titulo="Reaquecimento"
            sub="Presentes: mensagem pra marcar os 40 minutos com o Fabrício. Leads que não foram: pergunta da maior dificuldade e convite de 30 minutos." />
          <No tom="cinza" pos={em("7", 3)} titulo="Cadência de 7 dias"
            sub="Quem não fecha na call entra em acompanhamento de uma semana." />
          <No tom="cinza" pos={em("9", 3)} titulo="Pior cenário"
            sub="Se o evento não vender, os leads ficam: uma lista de empresários qualificados pro comercial trabalhar." />
        </div>
      </Fase>
    </div>
  );
}
