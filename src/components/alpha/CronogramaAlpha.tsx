// Encontros do ano do Alpha: os 12 meses com o tema e o andamento das tarefas no sistema.
// Clicar no mês abre a página do encontro (EncontroMes).
import type { DadosAlpha } from "./tipos";
import { MESES_NOME } from "./tipos";
import { ENCONTROS, progressoMes } from "./encontros";
import type { RegistroEncontro } from "./EncontroMes";

export function CronogramaAlpha({ d, registros, onAbrir }: {
  d: DadosAlpha; registros: RegistroEncontro[]; onAbrir: (mes: number) => void;
}) {
  const hoje = new Date();
  const mesAtual = hoje.getFullYear() === d.ano ? hoje.getMonth() + 1 : 0;
  return (
    <>
      <div className="al-aviso">Clique no mês para abrir o encontro: a aula, os números que abrem a Mesa, o que fazer no sistema, os compromissos e a ata.</div>
      <div className="al-crono">
        {ENCONTROS.map((e) => {
          const reg = registros.find((r) => r.mes === e.mes);
          const p = progressoMes(d, e.mes, reg?.tarefas ?? {});
          const cls = p.feitas === p.total ? "g" : p.feitas ? "a" : "r";
          return (
            <button type="button" key={e.mes} className={`p go ${e.mes === mesAtual ? "atual" : ""}`} onClick={() => onAbrir(e.mes)}>
              <div className="lbl">{MESES_NOME[e.mes - 1]}{e.mes === mesAtual ? " · agora" : ""}</div>
              <b style={{ fontSize: 14, margin: "4px 0" }}>{e.tema}</b>
              <div className="sub">{e.objetivo}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <div className="al-prog" style={{ flex: 1 }}><i className={cls} style={{ width: `${(p.feitas / p.total) * 100}%` }} /></div>
                <span className={`st ${cls === "g" ? "g" : cls === "a" ? "a" : "n"}`}>{p.feitas}/{p.total} no sistema</span>
              </div>
              <div>{e.marcos.map((m) => <span key={m} className="tag">{m}</span>)}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}
