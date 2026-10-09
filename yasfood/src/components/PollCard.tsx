import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { BarChart3, Check } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import type { Poll, PollOption, PollResult } from "@/lib/types";
import { useToast } from "@/components/ui";

const KEY = "dy_voter_key";
function voterKey() {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) { k = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; localStorage.setItem(KEY, k); }
    return k;
  } catch { return `anon-${Math.random().toString(36).slice(2, 12)}`; }
}
const votedKey = (pollId: string) => `dy_voted_${pollId}`;

/** Todas as enquetes ativas, uma embaixo da outra. Um voto por aparelho em cada. */
export function PollCard() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [results, setResults] = useState<PollResult[]>([]);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("polls").select("*").eq("active", true).order("created_at", { ascending: false });
    const list = (p as Poll[]) ?? [];
    setPolls(list);
    if (!list.length) return;
    const ids = list.map((x) => x.id);
    const [o, r] = await Promise.all([
      supabase.from("poll_options").select("*").in("poll_id", ids).order("sort_order"),
      supabase.from("poll_results").select("*").in("poll_id", ids).order("sort_order"),
    ]);
    setOptions((o.data as PollOption[]) ?? []);
    setResults((r.data as PollResult[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (polls.length === 0) return null;
  return (
    <div className="space-y-4">
      {polls.map((poll) => (
        <SinglePoll key={poll.id} poll={poll} options={options.filter((o) => o.poll_id === poll.id)} results={results.filter((r) => r.poll_id === poll.id)} onVoted={load} />
      ))}
    </div>
  );
}

function SinglePoll({ poll, options, results, onVoted }: { poll: Poll; options: PollOption[]; results: PollResult[]; onVoted: () => void }) {
  const toast = useToast();
  const [voted, setVoted] = useState<string | null>(() => { try { return localStorage.getItem(votedKey(poll.id)); } catch { return null; } });
  const [busy, setBusy] = useState(false);
  if (options.length === 0) return null;
  const total = results.reduce((a, r) => a + r.votes, 0);

  const vote = async (optionId: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("vote_poll", { p_poll_id: poll.id, p_option_id: optionId, p_voter_key: voterKey() });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    try { localStorage.setItem(votedKey(poll.id), optionId); } catch { /* ignore */ }
    setVoted(optionId);
    toast("Voto registrado. Obrigada!");
    onVoted();
  };

  return (
    <section className="rounded-3xl border border-choco-100 bg-white p-4 shadow-card">
      <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-vinho-600"><BarChart3 size={14} /> Enquete</div>
      <h3 className="text-lg font-black text-choco-900">{poll.question}</h3>
      {poll.description && <p className="mb-2 text-sm text-choco-600">{poll.description}</p>}
      <div className="mt-3 space-y-2">
        {options.map((o) => {
          const r = results.find((x) => x.option_id === o.id);
          const pct = total ? Math.round(((r?.votes ?? 0) / total) * 100) : 0;
          const mine = voted === o.id;
          const showBar = voted && poll.show_results;
          return (
            <button key={o.id} disabled={busy} onClick={() => vote(o.id)} className={clsx("relative w-full overflow-hidden rounded-xl border p-3 text-left text-sm font-semibold transition", mine ? "border-vinho-600 bg-vinho-50" : "border-choco-100 bg-white hover:border-vinho-300")}>
              {showBar && <span className="absolute inset-y-0 left-0 bg-rosa-100" style={{ width: `${pct}%` }} />}
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">{mine && <Check size={16} className="text-vinho-600" />}{o.label}</span>
                {showBar && <span className="text-xs text-choco-600">{pct}% · {r?.votes ?? 0}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-choco-400">{voted ? "Você pode mudar seu voto tocando em outra opção." : "Toque pra votar. Um voto por pessoa."}{total > 0 && voted ? ` · ${total} voto(s)` : ""}</p>
    </section>
  );
}
