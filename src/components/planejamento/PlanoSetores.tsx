// Plano de ação por setor: o que cada área faz, em que mês, como, por que e
// quem faz. É a parte do plano que alguém executa — o número sozinho não move
// ninguém. Dois modos de olhar: por setor e pelo calendário do ano.
import { useMemo, useState } from "react";
import { Panel } from "@/components/painel-controle/ui";

export type Acao = {
  id: string;
  setor: string;
  ordem_setor: number;
  mes: number;
  mes_fim: number | null;
  continua: boolean;
  titulo: string;
  o_que: string;
  como: string;
  por_que: string;
  quem: string;
  indicador: string | null;
  prioridade: "alta" | "media" | "baixa";
  status: "planejada" | "fazendo" | "feita" | "cancelada";
};

const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESC = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const STATUS: { k: Acao["status"]; rot: string }[] = [
  { k: "planejada", rot: "Planejada" },
  { k: "fazendo", rot: "Fazendo" },
  { k: "feita", rot: "Feita" },
  { k: "cancelada", rot: "Cancelada" },
];

/** Em que meses a ação aparece no calendário. */
const mesesDa = (a: Acao): number[] => {
  if (a.continua) return Array.from({ length: 12 - a.mes + 1 }, (_, i) => a.mes + i);
  if (a.mes_fim && a.mes_fim > a.mes) return Array.from({ length: a.mes_fim - a.mes + 1 }, (_, i) => a.mes + i);
  return [a.mes];
};

function Cartao({ a, aberta, onToggle, onStatus }: {
  a: Acao; aberta: boolean; onToggle: () => void; onStatus: (s: Acao["status"]) => void;
}) {
  const quando = a.continua
    ? `a partir de ${MES[a.mes - 1]}, todo mês`
    : a.mes_fim && a.mes_fim > a.mes
      ? `${MES[a.mes - 1]} a ${MES[a.mes_fim - 1]}`
      : MES[a.mes - 1];
  return (
    <div className={`pl-acao ${a.prioridade} ${a.status}`}>
      <button type="button" className="pl-acao-cab" onClick={onToggle} aria-expanded={aberta}>
        <span className="pl-acao-mes">{MESC[a.mes - 1]}</span>
        <span className="pl-acao-tit">
          <b>{a.titulo}</b>
          <small>{quando} · {a.quem}</small>
        </span>
        <span className={`pl-tag ${a.prioridade}`}>{a.prioridade === "alta" ? "alta" : a.prioridade === "media" ? "média" : "baixa"}</span>
        <span className="pl-seta">{aberta ? "−" : "+"}</span>
      </button>
      {aberta && (
        <div className="pl-acao-corpo">
          <div><b>O que é</b><p>{a.o_que}</p></div>
          <div><b>Como fazer</b><p>{a.como}</p></div>
          <div><b>Por que fazer</b><p>{a.por_que}</p></div>
          <div className="pl-acao-pe">
            <span><b>Quem:</b> {a.quem}</span>
            {a.indicador && a.indicador !== "nenhum" && <span><b>Mede por:</b> {a.indicador}</span>}
            <span className="pl-status">
              {STATUS.map((s) => (
                <button key={s.k} type="button" className={a.status === s.k ? "on" : ""} onClick={() => onStatus(s.k)}>{s.rot}</button>
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlanoSetores({ acoes, onStatus }: {
  acoes: Acao[];
  onStatus: (id: string, status: Acao["status"]) => void;
}) {
  const [modo, setModo] = useState<"setor" | "mes">("setor");
  const [setor, setSetor] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const setores = useMemo(() => {
    const m = new Map<string, Acao[]>();
    for (const a of acoes) {
      if (!m.has(a.setor)) m.set(a.setor, []);
      m.get(a.setor)!.push(a);
    }
    for (const v of m.values()) v.sort((x, y) => x.mes - y.mes || x.ordem_setor - y.ordem_setor);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [acoes]);

  const porMes = useMemo(() => Array.from({ length: 12 }, (_, i) =>
    acoes.filter((a) => mesesDa(a).includes(i + 1) && (!a.continua || a.mes === i + 1))
      .sort((x, y) => x.setor.localeCompare(y.setor))), [acoes]);

  const feitas = acoes.filter((a) => a.status === "feita").length;
  const fazendo = acoes.filter((a) => a.status === "fazendo").length;

  const toggle = (id: string) => setAberta((x) => (x === id ? null : id));

  return (
    <>
      <Panel
        titulo="Plano de ação do ano"
        sub={`${acoes.length} ações em ${setores.length} setores · ${feitas} feitas, ${fazendo} em andamento`}
      >
        <div className="pl-abas" style={{ marginBottom: 14 }}>
          <button type="button" className={modo === "setor" ? "on" : ""} onClick={() => setModo("setor")}>Por setor</button>
          <button type="button" className={modo === "mes" ? "on" : ""} onClick={() => setModo("mes")}>Pelo calendário</button>
        </div>

        {modo === "setor" && (
          <>
            <div className="pl-chips">
              <button type="button" className={setor === null ? "on" : ""} onClick={() => setSetor(null)}>Todos</button>
              {setores.map(([s, as]) => (
                <button key={s} type="button" className={setor === s ? "on" : ""} onClick={() => setSetor(s)}>
                  {s} <i>{as.length}</i>
                </button>
              ))}
            </div>
            {setores.filter(([s]) => setor === null || s === setor).map(([s, as]) => (
              <div key={s} className="pl-setor">
                <h3>{s}</h3>
                {as.map((a) => (
                  <Cartao key={a.id} a={a} aberta={aberta === a.id} onToggle={() => toggle(a.id)} onStatus={(st) => onStatus(a.id, st)} />
                ))}
              </div>
            ))}
          </>
        )}

        {modo === "mes" && porMes.map((as, i) => (
          <div key={i} className="pl-setor">
            <h3>{MES[i]} <i>{as.length} {as.length === 1 ? "ação começa" : "ações começam"}</i></h3>
            {as.length === 0
              ? <div className="pl-vazio">Nada novo começa neste mês. As rotinas dos meses anteriores seguem.</div>
              : as.map((a) => (
                <Cartao key={a.id} a={a} aberta={aberta === a.id} onToggle={() => toggle(a.id)} onStatus={(st) => onStatus(a.id, st)} />
              ))}
          </div>
        ))}
      </Panel>
    </>
  );
}
