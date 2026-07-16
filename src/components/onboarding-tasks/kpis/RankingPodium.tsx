import { Crown } from "lucide-react";

interface RankingRow { name: string; total: number; }
interface Props {
  data: RankingRow[];
  formatValue: (v: number) => string;
}

const initials = (name: string) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

// Ouro/prata/bronze do pódio (metáfora universal — não muda o tema do dashboard)
const MEDALS = [
  { p1: "#ffe08a", p2: "#e6a92e", p0: "#fff0bf", ring: "#ffcf4a", av1: "#ffd76a", av2: "#e6a92e", medalBg: "#ffe08a", rsh: "rgba(230,169,46,.6)" },
  { p1: "#e6edf7", p2: "#9aa6bd", p0: "#f4f7fc", ring: "#cdd6e6", av1: "#c2ccdd", av2: "#8f9bb3", medalBg: "#e6edf7", rsh: "rgba(140,153,180,.5)" },
  { p1: "#f0c3a0", p2: "#b06a38", p0: "#f7d9c1", ring: "#e0955a", av1: "#e6a26a", av2: "#b06a38", medalBg: "#e2a877", rsh: "rgba(154,94,48,.5)" },
];

const podiumStyle = `
.rkp-persp{ perspective:900px; }
.rkp-ped{ width:100%; border-radius:9px 9px 0 0; margin-top:12px; position:relative; transform-style:preserve-3d;
  transform:rotateX(18deg); display:grid; place-items:center; color:#fff; font-weight:900; font-size:22px;
  background:linear-gradient(180deg,var(--p1),var(--p2)); box-shadow:0 16px 26px -14px rgba(0,0,0,.5);
  animation:rkpRise 1s cubic-bezier(.2,.8,.2,1) both; }
.rkp-ped::before{ content:""; position:absolute; top:-8px; left:0; right:0; height:8px; border-radius:9px 9px 0 0;
  background:var(--p0); transform:rotateX(60deg); transform-origin:bottom; }
.rkp-mini{ height:5px; border-radius:3px; background:linear-gradient(90deg,hsl(var(--primary)),hsl(var(--primary)/.55)); }
@keyframes rkpRise{ from{ height:0; opacity:.3 } to{ height:var(--ph); opacity:1 } }
@media (prefers-reduced-motion: reduce){ .rkp-ped{ transform:none; animation:none } }
`;

export function RankingPodium({ data, formatValue }: Props) {
  const ranked = data.filter((r) => r.total > 0);
  if (ranked.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">Nenhum dado para o período selecionado</div>;
  }
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const grandTotal = ranked.reduce((s, r) => s + r.total, 0) || 1;
  const maxRest = Math.max(1, ...rest.map((r) => r.total));
  // ordem visual do pódio: 2º, 1º, 3º
  const order = [top3[1], top3[0], top3[2]].map((r, idx) => ({ r, place: [1, 0, 2][idx] }));
  const heights = [74, 104, 52]; // 2º,1º,3º

  return (
    <>
      <style>{podiumStyle}</style>
      <div className="flex justify-center items-end gap-3 rkp-persp mt-2 mb-1" style={{ minHeight: 190 }}>
        {order.map(({ r, place }, i) => {
          if (!r) return <div key={i} className="w-[92px]" />;
          const m = MEDALS[place];
          const ph = heights[i];
          return (
            <div key={r.name + place} className="flex flex-col items-center w-[92px]">
              <div className="relative w-14 h-14 rounded-full grid place-items-center font-extrabold text-lg text-white mb-2"
                style={{ background: `linear-gradient(145deg, ${m.av1}, ${m.av2})`, border: `2.5px solid ${m.ring}`, boxShadow: `0 10px 22px -8px ${m.rsh}` }}>
                {place === 0 && <Crown className="absolute -top-4 h-5 w-5 text-amber-400" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.4))" }} />}
                {initials(r.name)}
                <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full grid place-items-center text-[11px] font-extrabold border-2 border-card"
                  style={{ background: `linear-gradient(145deg, ${m.medalBg}, ${m.av2})`, color: "#3a2600" }}>{place + 1}</span>
              </div>
              <div className="text-[12.5px] font-extrabold text-center leading-tight text-foreground line-clamp-1 max-w-full">{r.name.split(/\s+/)[0]}</div>
              <div className="text-[11.5px] font-bold text-muted-foreground">{formatValue(r.total)}</div>
              <div className="rkp-ped w-full" style={{ height: ph, "--ph": `${ph}px`, "--p0": m.p0, "--p1": m.p1, "--p2": m.p2 } as React.CSSProperties}>{place + 1}</div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div className="flex flex-col gap-2 mt-4">
          {rest.map((r, i) => (
            <div key={r.name} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
              <span className="w-6 h-6 rounded-md bg-background grid place-items-center text-[11px] font-extrabold text-muted-foreground shrink-0">{i + 4}</span>
              <span className="w-8 h-8 rounded-full grid place-items-center text-[12px] font-extrabold text-primary-foreground shrink-0"
                style={{ background: "hsl(var(--primary))" }}>{initials(r.name)}</span>
              <span className="text-[13px] font-semibold flex-1 min-w-0 truncate">{r.name}</span>
              <div className="rkp-mini hidden sm:block" style={{ width: `${Math.max(16, (r.total / maxRest) * 80)}px` }} />
              <span className="text-[12.5px] font-extrabold text-muted-foreground tabular-nums shrink-0">{formatValue(r.total)}</span>
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && top3[2] && rest[0] && (
        <p className="text-[11px] text-muted-foreground text-center mt-3">
          <b className="text-foreground">{rest[0].name.split(/\s+/)[0]}</b> está a{" "}
          <b className="text-emerald-600 dark:text-emerald-400">{formatValue(top3[2].total - rest[0].total)}</b> de subir pro pódio 🔥
        </p>
      )}

      {/* placar do time em % */}
      <div className="flex flex-col gap-2 mt-5">
        {top3.filter(Boolean).map((r, i) => (
          <div key={r.name} className="grid items-center gap-3" style={{ gridTemplateColumns: "108px 1fr auto" }}>
            <span className="text-xs font-semibold text-foreground truncate">{["🥇", "🥈", "🥉"][i]} {r.name.split(/\s+/)[0]}</span>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(r.total / grandTotal) * 100}%`, background: "hsl(var(--primary))" }} />
            </div>
            <span className="text-xs font-extrabold text-foreground tabular-nums">{Math.round((r.total / grandTotal) * 100)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}
