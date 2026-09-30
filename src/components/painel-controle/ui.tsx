// Peças visuais do Painel de Controle, portadas da referência do painel MD1.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { esc } from "./util";
import { mesLabel, mesCurto } from "./fmt";
import type { MesSerie } from "./tipos";

/* ---------- KPI ---------- */
export function Tile({ label, valor, sub, onClick, main, cls }: {
  label: string; valor: string; sub?: ReactNode; onClick?: () => void; main?: boolean; cls?: string;
}) {
  const nd = valor === "-";
  return (
    <button type="button" className={`p go ${main ? "main" : ""}`} onClick={onClick}>
      <div className="lbl">{label}</div>
      <div className={`val ${nd ? "nd" : ""} ${cls ?? ""}`}>{valor}</div>
      <div className={`sub ${nd ? "nd" : ""}`}>{nd && !sub ? "sem fonte" : sub}</div>
    </button>
  );
}

/* ---------- painel com título ---------- */
export function Panel({ titulo, sub, children, onClick, more, cls }: {
  titulo: ReactNode; sub?: ReactNode; children?: ReactNode; onClick?: () => void; more?: string; cls?: string;
}) {
  const inner = (
    <>
      <div className="h"><b>{titulo}</b>{sub != null && <span>{sub}</span>}</div>
      {children}
      {more && <span className="more">{more}</span>}
    </>
  );
  if (onClick) return <button type="button" className={`p go ${cls ?? ""}`} onClick={onClick}>{inner}</button>;
  return <div className={`p ${cls ?? ""}`}>{inner}</div>;
}

/* ---------- linha de funil (barra horizontal) ---------- */
export function HRow({ nome, p, v, c, tip, bad, hi, onClick }: {
  nome: string; p: number | null; v: string; c?: ReactNode; tip?: string; bad?: boolean; hi?: boolean; onClick?: () => void;
}) {
  return (
    <div className={`fr ${onClick ? "go" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}>
      <span className="n">{nome}</span>
      <div className="tr" data-tip={tip || undefined}>
        {p != null && <i className={bad ? "bad" : hi ? "hi" : ""} style={{ width: `${Math.max(Math.min(p, 1) * 100, 1)}%` }} />}
      </div>
      <span className={`v ${v === "-" ? "nd" : ""}`}>{v}</span>
      <span className="c">{c}</span>
    </div>
  );
}

/* ---------- barra horizontal simples com nome ---------- */
export function BarH({ nome, p, v, onClick, bad }: { nome: string; p: number; v: string; onClick?: () => void; bad?: boolean }) {
  return (
    <div className="barh">
      {onClick ? <button type="button" className="lk n" onClick={onClick}>{nome}</button> : <span className="n">{nome}</span>}
      <div className="tr"><i className={bad ? "bad" : ""} style={{ width: `${Math.max(Math.min(p, 1) * 100, 1)}%` }} /></div>
      <span className="v">{v}</span>
    </div>
  );
}

/* ---------- ranking (SDR / closer) ---------- */
export function Rank({ nome, p, det, bad, onClick }: { nome: string; p: number; det: ReactNode; bad?: boolean; onClick?: () => void }) {
  return (
    <div className="rk">
      <span><button type="button" className="lk" onClick={onClick}>{nome}</button></span>
      <div className="tr"><i className={bad ? "bad" : ""} style={{ width: `${Math.max(p * 100, 2)}%` }} /></div>
      <b>{Math.round(p * 100)}%</b>
      <small>{det}</small>
    </div>
  );
}

/* ---------- tabela ---------- */
export type Col = { h: string; tl?: boolean };
export function Tabela({ cols, rows, hl, onRow, vazio }: {
  cols: (string | Col)[]; rows: ReactNode[][]; hl?: number; onRow?: (i: number) => void; vazio?: string;
}) {
  if (!rows.length) return <div className="empty">{vazio ?? "Sem dados para este filtro."}</div>;
  return (
    <div className="tw">
      <table>
        <thead><tr>{cols.map((c, i) => { const col = typeof c === "string" ? { h: c } : c; return <th key={i} className={col.tl ? "tl" : ""}>{col.h}</th>; })}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`${i === hl ? "hl" : ""} ${onRow ? "rw" : ""}`} onClick={onRow ? () => onRow(i) : undefined}>
              {r.map((c, j) => { const col = typeof cols[j] === "string" ? { h: "" } : (cols[j] as Col); return <td key={j} className={col?.tl ? "tl" : ""}>{c}</td>; })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- link que filtra / navega ---------- */
export function Lk({ children, onClick, ext, title }: { children: ReactNode; onClick: () => void; ext?: boolean; title?: string }) {
  return <button type="button" className={`lk ${ext ? "ext" : ""}`} onClick={(e) => { e.stopPropagation(); onClick(); }} title={title}>{children}</button>;
}

/* ---------- situação ---------- */
export function St({ ok, warn, tg, tw, tb }: { ok: boolean; warn?: boolean; tg: string; tw?: string; tb?: string }) {
  return <span className={`st ${ok ? "g" : warn ? "a" : "r"}`}>{ok ? tg : warn ? tw : tb}</span>;
}
export const Nd = ({ children }: { children?: ReactNode }) => <span className="nd">{children ?? "-"}</span>;

/* ---------- barras mês a mês, clicáveis ---------- */
export function Barras({ serie, mes, fn, fmt, sub, onMes, permiteNegativo }: {
  serie: MesSerie[]; mes: string; fn: (m: MesSerie) => number | null | undefined; fmt: (v: number) => string;
  sub?: (m: MesSerie) => ReactNode; onMes: (mes: string) => void; permiteNegativo?: boolean;
}) {
  const vals = serie.map((m) => { const v = fn(m); return v == null ? null : Number(v); });
  const mx = Math.max(...vals.map((v) => Math.abs(v ?? 0)), 1e-9);
  return (
    <div className="bars">
      {serie.map((m, j) => {
        const v = vals[j];
        const t = `${mesLabel(m.mes)}: ${v == null ? "sem dados" : fmt(v)}`;
        const neg = permiteNegativo && v != null && v < 0;
        return (
          <button type="button" key={m.mes} className={`bc ${m.mes === mes ? "on" : ""}`} data-tip={t} aria-label={t} onClick={() => onMes(m.mes)}>
            <i className={neg ? "neg" : ""} style={{ height: `${v ? (Math.abs(v) / mx) * 100 : 0}%` }} />
            <small>{mesCurto(m.mes)}<b>{v == null ? "-" : fmt(v)}</b>{sub ? sub(m) : null}</small>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- combo com busca por digitação ---------- */
export type Opt = { value: string; label: string };
export function Combo({ k, label, value, opts, todos, onChange }: {
  k: string; label: string; value: string; opts: Opt[]; todos?: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    setTimeout(() => inp.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const all = useMemo(() => (todos ? [{ value: "", label: todos }, ...opts] : opts), [opts, todos]);
  const vis = useMemo(() => { const t = esc(q); return all.filter((o) => !t || esc(o.label).includes(t)); }, [all, q]);
  const cur = all.find((o) => o.value === value)?.label ?? todos ?? "";
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(""); };
  return (
    <div className={`cb ${value && todos ? "on" : ""}`} data-k={k} ref={ref}>
      <label id={`l-${k}`}>{label}</label>
      <button type="button" className="cbb" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`l-${k}`} onClick={() => setOpen((o) => !o)}>{cur}</button>
      {open && (
        <div className="cbp">
          <input ref={inp} type="search" placeholder="Digite para buscar" aria-label={`Buscar ${label}`} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && vis[0]) pick(vis[0].value); }} />
          <ul role="listbox">
            {vis.map((o) => (
              <li key={o.value || "__todos"} role="option" aria-selected={o.value === value} className={o.value === value ? "sel" : ""} tabIndex={0}
                onClick={() => pick(o.value)} onKeyDown={(e) => { if (e.key === "Enter") pick(o.value); }}>{o.label}</li>
            ))}
            {!vis.length && <li className="nd">Nenhum resultado</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- topo ---------- */
export function Topo({ mes, meses, onMes, onHome, onSair, geradoEm, alertas }: {
  mes: string; meses: string[]; onMes: (m: string) => void; onHome: () => void; onSair: () => void; geradoEm?: string; alertas: number;
}) {
  return (
    <div className="top">
      <button type="button" className="brand" onClick={onHome} title="Página inicial do painel" aria-label="Voltar para a página inicial do painel">
        <div className="lg">UNV</div>
        <div className="wm">NEXUS<small>PAINEL DE CONTROLE</small></div>
      </button>
      <div className="sep" />
      <div className="ttl">Cockpit do dono<b>{mesLabel(mes)}</b></div>
      <div className="ctl">
        <Combo k="mes" label="Mês" value={mes} opts={[...meses].reverse().map((m) => ({ value: m, label: mesLabel(m) }))} onChange={onMes} />
        <button type="button" className="back" onClick={onSair} style={{ marginTop: 14 }}>Voltar ao Nexus</button>
      </div>
      <div className="src">
        <span className={`dot ${alertas ? "r" : "g"}`} />{alertas ? `${alertas} ${alertas === 1 ? "item exige" : "itens exigem"} sua decisão` : "Nada fora do padrão"}
        {geradoEm && <><br />dados do banco, gerados às {new Date(geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>}
      </div>
    </div>
  );
}

/* ---------- cabeçalho de tela interna com breadcrumb ---------- */
export function Cab({ titulo, sub, crumbs, onBack, onCrumb, filtros }: {
  titulo: string; sub?: string; crumbs: string[]; onBack: () => void; onCrumb: (i: number) => void; filtros?: ReactNode;
}) {
  return (
    <div>
      <div className="crumbs">
        <button type="button" onClick={() => onCrumb(-1)}>Visão geral</button>
        {crumbs.map((c, i) => (<span key={i}> / {i === crumbs.length - 1 ? <span className="cur">{c}</span> : <button type="button" onClick={() => onCrumb(i)}>{c}</button>}</span>))}
      </div>
      <div className="bar2" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="back" onClick={onBack}>Voltar</button>
          <h1 className="pt">{titulo}{sub && <small>{sub}</small>}</h1>
        </div>
        {filtros && <div className="fs">{filtros}</div>}
      </div>
    </div>
  );
}
