import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Gift } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

interface Prize {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  prize_type: string;
  value: number | null;
  weight: number;
  total_quantity: number | null;
  quantity_remaining: number | null;
}

interface BalloonCampaign {
  id: string;
  name: string;
  description: string | null;
  balloons_per_achievement: number;
  prize_mode: string;
  balloon_colors: string[];
  goal_type: string;
  goal_source: string;
  kpi_id: string | null;
  goal_value: number | null;
}

interface BalloonPopGameProps {
  campaignId: string;
  projectId: string;
  companyId: string;
  onClose: () => void;
}

interface Balloon {
  id: number;
  color: string;
  x: number;
  y: number;
  size: number;
  delay: number;
  popped: boolean;
  prize?: Prize;
}

interface SalespersonOption {
  id: string;
  name: string;
}

export const BalloonPopGame = ({ campaignId, projectId, companyId, onClose }: BalloonPopGameProps) => {
  const [campaign, setCampaign] = useState<BalloonCampaign | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [balloonsRemaining, setBalloonsRemaining] = useState(0);
  const [revealedPrize, setRevealedPrize] = useState<Prize | null>(null);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [salespeople, setSalespeople] = useState<SalespersonOption[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("");
  const [selectedSalespersonName, setSelectedSalespersonName] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [poppedPrizes, setPoppedPrizes] = useState<Prize[]>([]);

  useEffect(() => { fetchData(); }, [campaignId]);

  const fetchData = async () => {
    try {
      const [campaignRes, prizesRes, spRes] = await Promise.all([
        supabase.from("endomarketing_balloon_campaigns").select("*").eq("id", campaignId).single(),
        supabase.from("endomarketing_balloon_prizes").select("*").eq("campaign_id", campaignId).eq("is_active", true).order("sort_order"),
        supabase.from("company_salespeople").select("id, name").eq("company_id", companyId).eq("is_active", true).order("name"),
      ]);

      if (campaignRes.error) throw campaignRes.error;
      setCampaign(campaignRes.data);
      setPrizes(prizesRes.data || []);
      setSalespeople(spRes.data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao carregar campanha");
    } finally {
      setLoading(false);
    }
  };

  const pickRandomPrize = useCallback((): Prize | null => {
    if (prizes.length === 0) return null;

    const mode = campaign?.prize_mode || "weighted";
    const availablePrizes = prizes.filter(p => {
      if (mode === "fixed_pool" && p.quantity_remaining !== null && p.quantity_remaining <= 0) return false;
      return true;
    });

    if (availablePrizes.length === 0) return null;

    if (mode === "equal") {
      return availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
    }

    // weighted
    const totalWeight = availablePrizes.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    for (const prize of availablePrizes) {
      random -= prize.weight;
      if (random <= 0) return prize;
    }
    return availablePrizes[availablePrizes.length - 1];
  }, [prizes, campaign]);

  const startGame = () => {
    if (!selectedSalesperson) {
      toast.error("Selecione o vendedor");
      return;
    }
    if (!campaign) return;

    const sp = salespeople.find(s => s.id === selectedSalesperson);
    setSelectedSalespersonName(sp?.name || "");

    const count = campaign.balloons_per_achievement;
    const colors = (campaign.balloon_colors as string[]) || ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6'];
    
    const newBalloons: Balloon[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      x: 10 + (i % 5) * 18 + Math.random() * 5,
      y: 15 + Math.floor(i / 5) * 30 + Math.random() * 10,
      size: 70 + Math.random() * 20,
      delay: i * 0.1,
      popped: false,
    }));

    setBalloons(newBalloons);
    setBalloonsRemaining(count);
    setPoppedPrizes([]);
    setGameStarted(true);
  };

  const popBalloon = async (balloonId: number) => {
    if (!campaign) return;

    const balloon = balloons.find(b => b.id === balloonId);
    if (!balloon || balloon.popped) return;

    const prize = pickRandomPrize();
    if (!prize) {
      toast.error("Sem prêmios disponíveis!");
      return;
    }

    // Mark balloon as popped
    setBalloons(prev => prev.map(b => b.id === balloonId ? { ...b, popped: true, prize } : b));
    setBalloonsRemaining(prev => prev - 1);
    setPoppedPrizes(prev => [...prev, prize]);

    // Show confetti for good prizes
    if (prize.prize_type !== "try_again" && prize.prize_type !== "message") {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: balloon.x / 100, y: balloon.y / 100 },
        colors: [balloon.color, '#ffd700', '#ffffff'],
      });
    }

    // Show prize
    setRevealedPrize(prize);
    setShowPrizeModal(true);

    // Save to database
    try {
      const periodKey = getPeriodKey(campaign.goal_type);
      await supabase.from("endomarketing_balloon_pops").insert({
        campaign_id: campaignId,
        salesperson_id: selectedSalesperson,
        salesperson_name: selectedSalespersonName,
        prize_id: prize.id,
        prize_name: prize.name,
        prize_type: prize.prize_type,
        period_key: periodKey,
      });

      // Decrease stock for fixed_pool
      if (campaign.prize_mode === "fixed_pool" && prize.quantity_remaining !== null) {
        await supabase.from("endomarketing_balloon_prizes")
          .update({ quantity_remaining: prize.quantity_remaining - 1 })
          .eq("id", prize.id);
        
        setPrizes(prev => prev.map(p => 
          p.id === prize.id && p.quantity_remaining !== null
            ? { ...p, quantity_remaining: p.quantity_remaining - 1 }
            : p
        ));
      }
    } catch (error) {
      console.error("Error saving pop:", error);
    }
  };

  const getPeriodKey = (goalType: string): string => {
    const now = new Date();
    switch (goalType) {
      case "daily": return now.toISOString().slice(0, 10);
      case "weekly": {
        const weekNum = Math.ceil((now.getDate()) / 7);
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-W${weekNum}`;
      }
      case "biweekly": {
        const half = now.getDate() <= 15 ? "1" : "2";
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-H${half}`;
      }
      case "monthly": return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      default: return now.toISOString().slice(0, 10);
    }
  };

  if (loading) {
    return (
      <Card><CardContent className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </CardContent></Card>
    );
  }

  if (!campaign) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h3 className="text-lg font-semibold">🎈 {campaign.name}</h3>
          <p className="text-sm text-muted-foreground">{campaign.description}</p>
        </div>
      </div>

      {!gameStarted ? (
        /* Salesperson Selection */
        <Card>
          <CardContent className="py-8 space-y-6">
            <div className="text-center space-y-2">
              <p className="text-5xl">🎈</p>
              <h3 className="text-xl font-bold">Hora de Estourar Balões!</h3>
              <p className="text-muted-foreground">Selecione o vendedor que bateu a meta para começar</p>
            </div>
            
            <div className="max-w-md mx-auto space-y-4">
              <select
                value={selectedSalesperson}
                onChange={e => setSelectedSalesperson(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione o vendedor...</option>
                {salespeople.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
              </select>

              <Button onClick={startGame} className="w-full gap-2" size="lg" disabled={!selectedSalesperson}>
                🎈 Começar! ({campaign.balloons_per_achievement} balões)
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Balloon Game Area */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{selectedSalespersonName}</p>
              <p className="text-sm text-muted-foreground">
                {balloonsRemaining > 0 ? `${balloonsRemaining} balões restantes` : "Todos os balões estourados!"}
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              🎈 {balloonsRemaining}
            </Badge>
          </div>

          {/* Balloon Grid */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative min-h-[400px] bg-gradient-to-b from-sky-100 to-sky-50 dark:from-sky-950 dark:to-sky-900">
                {/* Clouds decoration */}
                <div className="absolute top-4 left-8 w-24 h-8 bg-white/30 dark:bg-white/10 rounded-full blur-sm" />
                <div className="absolute top-12 right-16 w-32 h-10 bg-white/20 dark:bg-white/5 rounded-full blur-sm" />
                
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 p-6">
                  <AnimatePresence>
                    {balloons.map(balloon => (
                      <motion.div
                        key={balloon.id}
                        initial={{ scale: 0, y: 50 }}
                        animate={balloon.popped ? { scale: [1.3, 0], opacity: [1, 0] } : { scale: 1, y: [0, -8, 0] }}
                        transition={balloon.popped 
                          ? { duration: 0.3 } 
                          : { y: { repeat: Infinity, duration: 2 + balloon.delay, ease: "easeInOut" }, scale: { duration: 0.5, delay: balloon.delay } }
                        }
                        className="flex flex-col items-center"
                      >
                        {!balloon.popped && (
                          <button
                            onClick={() => popBalloon(balloon.id)}
                            className="group relative cursor-pointer transition-transform hover:scale-110 active:scale-95"
                            style={{ filter: `drop-shadow(0 4px 8px ${balloon.color}40)` }}
                          >
                            {/* Balloon SVG */}
                            <svg width={balloon.size} height={balloon.size * 1.3} viewBox="0 0 100 130" className="transition-transform group-hover:rotate-3">
                              <defs>
                                <radialGradient id={`grad-${balloon.id}`} cx="35%" cy="35%" r="65%">
                                  <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                                  <stop offset="30%" stopColor={balloon.color} stopOpacity="0.9" />
                                  <stop offset="100%" stopColor={balloon.color} />
                                </radialGradient>
                              </defs>
                              {/* Balloon body */}
                              <ellipse cx="50" cy="45" rx="38" ry="42" fill={`url(#grad-${balloon.id})`} />
                              {/* Balloon knot */}
                              <polygon points="50,87 45,92 55,92" fill={balloon.color} />
                              {/* String */}
                              <path d="M50,92 Q48,105 52,115 Q50,120 50,130" stroke={balloon.color} strokeWidth="1.5" fill="none" opacity="0.6" />
                              {/* Shine */}
                              <ellipse cx="38" cy="30" rx="8" ry="12" fill="white" opacity="0.25" transform="rotate(-20, 38, 30)" />
                            </svg>
                            {/* Question mark */}
                            <span className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-2xl font-bold opacity-60 pointer-events-none select-none">
                              ?
                            </span>
                          </button>
                        )}

                        {/* Pop particles */}
                        {balloon.popped && (
                          <motion.div
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.8 }}
                            className="text-3xl"
                          >
                            💥
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Popped prizes summary */}
          {poppedPrizes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4" /> Prêmios Conquistados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {poppedPrizes.map((prize, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <span className="text-2xl">{prize.emoji}</span>
                      <div>
                        <p className="font-medium">{prize.name}</p>
                        {prize.description && <p className="text-sm text-muted-foreground">{prize.description}</p>}
                      </div>
                      <Badge variant="outline" className="ml-auto">
                        {prize.prize_type === "physical" ? "Brinde" : 
                         prize.prize_type === "bonus" ? `R$ ${prize.value}` :
                         prize.prize_type === "message" ? "Mensagem" : "Tente novamente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {balloonsRemaining === 0 && (
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { setGameStarted(false); setSelectedSalesperson(""); }}>
                Novo Vendedor
              </Button>
              <Button variant="outline" onClick={onClose}>
                Voltar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Prize Reveal Modal */}
      <AnimatePresence>
        {showPrizeModal && revealedPrize && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPrizeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-background rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-6xl mb-4"
              >
                {revealedPrize.emoji}
              </motion.div>
              <h3 className="text-xl font-bold mb-2">{revealedPrize.name}</h3>
              {revealedPrize.description && (
                <p className="text-muted-foreground mb-4">{revealedPrize.description}</p>
              )}
              {revealedPrize.prize_type === "bonus" && revealedPrize.value && (
                <p className="text-2xl font-bold text-primary mb-4">
                  R$ {revealedPrize.value.toFixed(2)}
                </p>
              )}
              <Badge className="mb-6">
                {revealedPrize.prize_type === "physical" ? "🎁 Brinde Físico" :
                 revealedPrize.prize_type === "bonus" ? "💰 Bônus" :
                 revealedPrize.prize_type === "message" ? "💬 Motivação" : "🔄 Tente Novamente"}
              </Badge>
              <br />
              <Button onClick={() => setShowPrizeModal(false)} className="mt-4">
                {balloonsRemaining > 0 ? "Próximo Balão! 🎈" : "Finalizar 🎉"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
