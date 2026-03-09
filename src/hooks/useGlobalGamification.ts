import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GlobalParticipant {
  id: string;
  salesperson_id: string;
  salesperson_name: string;
  company_id: string;
  company_name: string;
  total_points: number;
  current_level: number;
  level_name: string;
  config_id: string;
  segment?: string;
}

export interface GlobalScoreLog {
  id: string;
  participant_id: string;
  points: number;
  reason: string;
  entry_date: string;
  created_at: string;
}

export interface CompanySummary {
  company_id: string;
  company_name: string;
  segment: string | null;
  participant_count: number;
  total_points: number;
  avg_points: number;
  top_salesperson: string;
  top_points: number;
}

export interface LeagueEntry {
  league: string;
  color: string;
  icon: string;
  min_points: number;
  max_points: number | null;
  participants: GlobalParticipant[];
}

const LEAGUES: Omit<LeagueEntry, "participants">[] = [
  { league: "Diamante", color: "from-cyan-400 to-blue-500", icon: "💎", min_points: 5000, max_points: null },
  { league: "Ouro", color: "from-yellow-400 to-amber-500", icon: "🥇", min_points: 2500, max_points: 4999 },
  { league: "Prata", color: "from-gray-300 to-gray-400", icon: "🥈", min_points: 1000, max_points: 2499 },
  { league: "Bronze", color: "from-orange-400 to-orange-600", icon: "🥉", min_points: 500, max_points: 999 },
  { league: "Iniciante", color: "from-green-400 to-emerald-500", icon: "🌱", min_points: 0, max_points: 499 },
];

export function useGlobalGamification() {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<GlobalParticipant[]>([]);
  const [scoreLogs, setScoreLogs] = useState<GlobalScoreLog[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all participants with their salesperson and company data
      const { data: participantsData } = await supabase
        .from("gamification_participants")
        .select(`
          id, total_points, current_level, config_id,
          salesperson:company_salespeople(id, name, company_id)
        `)
        .order("total_points", { ascending: false });

      if (!participantsData?.length) {
        setLoading(false);
        return;
      }

      // Get unique config IDs to fetch levels
      const configIds = [...new Set(participantsData.map((p: any) => p.config_id))];
      
      // Fetch levels for all configs
      const { data: levelsData } = await supabase
        .from("gamification_levels")
        .select("*")
        .in("config_id", configIds)
        .order("level_number");

      // Get unique company IDs
      const companyIds = [...new Set(
        participantsData
          .map((p: any) => p.salesperson?.company_id)
          .filter(Boolean)
      )];

      // Fetch company names and segments
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, name, segment")
        .in("id", companyIds);

      const companyMap = new Map(
        (companiesData || []).map((c: any) => [c.id, c])
      );

      // Build levels map per config
      const levelsMap = new Map<string, any[]>();
      (levelsData || []).forEach((l: any) => {
        if (!levelsMap.has(l.config_id)) levelsMap.set(l.config_id, []);
        levelsMap.get(l.config_id)!.push(l);
      });

      const getLevelName = (configId: string, level: number) => {
        const levels = levelsMap.get(configId) || [];
        const found = levels.find((l: any) => l.level_number === level);
        return found?.name || `Nível ${level}`;
      };

      const mappedParticipants: GlobalParticipant[] = participantsData
        .filter((p: any) => p.salesperson)
        .map((p: any) => {
          const company = companyMap.get(p.salesperson.company_id);
          return {
            id: p.id,
            salesperson_id: p.salesperson.id,
            salesperson_name: p.salesperson.name,
            company_id: p.salesperson.company_id,
            company_name: company?.name || "Desconhecida",
            total_points: p.total_points || 0,
            current_level: p.current_level || 1,
            level_name: getLevelName(p.config_id, p.current_level || 1),
            config_id: p.config_id,
            segment: company?.segment || null,
          };
        })
        .sort((a: GlobalParticipant, b: GlobalParticipant) => b.total_points - a.total_points);

      setParticipants(mappedParticipants);

      // Build company summaries
      const companySummaries = new Map<string, CompanySummary>();
      mappedParticipants.forEach((p) => {
        if (!companySummaries.has(p.company_id)) {
          companySummaries.set(p.company_id, {
            company_id: p.company_id,
            company_name: p.company_name,
            segment: p.segment || null,
            participant_count: 0,
            total_points: 0,
            avg_points: 0,
            top_salesperson: "",
            top_points: 0,
          });
        }
        const summary = companySummaries.get(p.company_id)!;
        summary.participant_count++;
        summary.total_points += p.total_points;
        summary.avg_points = Math.round(summary.total_points / summary.participant_count);
        if (p.total_points > summary.top_points) {
          summary.top_points = p.total_points;
          summary.top_salesperson = p.salesperson_name;
        }
      });
      setCompanies(Array.from(companySummaries.values()).sort((a, b) => b.total_points - a.total_points));

      // Fetch recent score logs (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: logsData } = await supabase
        .from("gamification_score_logs")
        .select("id, participant_id, points, reason, entry_date, created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      setScoreLogs(logsData || []);
    } catch (error) {
      console.error("Error fetching global gamification data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered participants
  const filteredParticipants = useMemo(() => {
    let result = participants;
    if (selectedCompanyId) {
      result = result.filter((p) => p.company_id === selectedCompanyId);
    }
    if (selectedSegment) {
      result = result.filter((p) => p.segment === selectedSegment);
    }
    return result;
  }, [participants, selectedCompanyId, selectedSegment]);

  // Leagues
  const leagues: LeagueEntry[] = useMemo(() => {
    return LEAGUES.map((league) => ({
      ...league,
      participants: filteredParticipants.filter((p) => {
        if (league.max_points === null) return p.total_points >= league.min_points;
        return p.total_points >= league.min_points && p.total_points <= league.max_points;
      }),
    }));
  }, [filteredParticipants]);

  // Hall of Fame (top 10 all-time)
  const hallOfFame = useMemo(() => {
    return filteredParticipants.slice(0, 10);
  }, [filteredParticipants]);

  // Segments list
  const segments = useMemo(() => {
    const segSet = new Set(participants.map((p) => p.segment).filter(Boolean));
    return Array.from(segSet).sort() as string[];
  }, [participants]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredParticipants.length;
    const totalPoints = filteredParticipants.reduce((sum, p) => sum + p.total_points, 0);
    const avgPoints = total > 0 ? Math.round(totalPoints / total) : 0;
    const activeCompanies = new Set(filteredParticipants.map((p) => p.company_id)).size;
    const recentLogs = scoreLogs.length;
    return { total, totalPoints, avgPoints, activeCompanies, recentLogs };
  }, [filteredParticipants, scoreLogs]);

  return {
    loading,
    participants: filteredParticipants,
    allParticipants: participants,
    companies,
    leagues,
    hallOfFame,
    segments,
    stats,
    scoreLogs,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedSegment,
    setSelectedSegment,
    refetch: fetchData,
  };
}
