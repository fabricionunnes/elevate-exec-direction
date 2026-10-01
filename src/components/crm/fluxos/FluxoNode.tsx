// Cartão de um bloco no canvas: faixa colorida, ícone, título, resumo e as saídas nomeadas.
// A Nota é um bloco à parte: papel de anotação, sem ligações.
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CATALOGO, LISTAS_VAZIAS, resumoBloco, type NodeType, type Listas } from "./catalogo";

export interface FluxoNodeData {
  [k: string]: any;
  _listas?: Listas; _trigger?: string; _ativo?: boolean;
  _stats?: { n: number; erros: number; espera: number } | null;
}

function FluxoNodeInner({ id, type, data, selected }: NodeProps) {
  const t = type as NodeType;
  const def = CATALOGO[t];
  if (!def) return <div className="rounded-lg border border-border bg-background p-2 text-xs text-foreground">Bloco desconhecido</div>;
  const d = data as FluxoNodeData;
  const Icon = def.icon;

  if (t === "note") {
    return (
      <div className={`w-[220px] rounded-md border border-amber-400/60 bg-amber-200/70 dark:bg-amber-500/20 shadow-sm ${selected ? "ring-2 ring-primary" : ""}`} data-node-id={id}>
        <div className="flex items-center gap-1.5 px-2.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
          <Icon className="h-3 w-3" /> {d.label || "Nota"}
        </div>
        <p className="px-2.5 pb-2.5 pt-1 text-[11px] leading-snug text-foreground whitespace-pre-wrap break-words min-h-[36px]">
          {String(d.text || "") || <span className="italic text-muted-foreground">Escreva a anotação no painel ao lado</span>}
        </p>
      </div>
    );
  }

  const resumo = resumoBloco(t, d, d._listas || LISTAS_VAZIAS, d._trigger);
  const saidas = def.saidas;
  return (
    <div
      className={`w-[230px] rounded-xl border border-border bg-background shadow-sm transition-shadow ${selected ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"} ${d._ativo ? "ring-2 ring-emerald-500" : ""}`}
      data-node-id={id}
    >
      {def.entrada && <Handle type="target" position={Position.Top} className="!h-3 !w-3 !rounded-full !border-2 !border-background" style={{ background: def.cor }} />}
      <div className="flex items-center gap-2 rounded-t-xl px-3 py-2 text-white" style={{ background: def.cor }}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-semibold truncate">{d.label || def.label}</span>
        {d._stats && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium" title="Execuções que passaram por aqui (dois cliques pra ver quem)">
            <span className="rounded bg-white/25 px-1 tabular-nums">{d._stats.n}</span>
            {d._stats.espera > 0 && <span className="rounded bg-black/30 px-1 tabular-nums">{d._stats.espera} aqui</span>}
            {d._stats.erros > 0 && <span className="rounded bg-red-900/70 px-1 tabular-nums">{d._stats.erros} erro</span>}
          </span>
        )}
      </div>
      <div className="px-3 py-2 text-[11px] text-muted-foreground min-h-[30px] leading-snug break-words">
        {resumo || <span className="italic">{def.desc || "Sem configuração"}</span>}
      </div>
      {saidas.length > 0 && (
        <div className="relative h-5 border-t border-border">
          {saidas.map((s, i) => {
            const left = saidas.length === 1 ? 50 : ((i + 1) * 100) / (saidas.length + 1);
            return (
              <div key={s.id} className="absolute -bottom-[7px] flex flex-col items-center" style={{ left: `${left}%`, transform: "translateX(-50%)" }}>
                {s.label && <span className="absolute -top-[17px] text-[9px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">{s.label}</span>}
                <Handle type="source" position={Position.Bottom} id={s.id} className="!h-3 !w-3 !rounded-full !border-2 !border-background !static !transform-none" style={{ background: def.cor }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const FluxoNode = memo(FluxoNodeInner);
