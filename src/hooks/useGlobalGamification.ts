import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface GlobalParticipant {
  id: string;
  salesperson_id: string;
  salesperson_name: string;
  company_id: string;
  company_name: string;
  segment?: string;
  // KPI-based metrics
  total_achieved: number;
  total_target: number;
  achievement_percent: number;
  kpi_name?: string;
}

export interface CompanySummary {
  company_id: string;
  company_name: string;
  segment: string | null;
  participant_count: number;
  total_achieved: number;
  total_target: number;
  avg_percent: number;
  top_salesperson: string;
  top_percent: number;
}

export interface LeagueEntry {
  league: string;
  color: string;
  icon: string;
  min_percent: number;
  max_percent: number | null;
  participants: GlobalParticipant[];
}

const LEAGUES: Omit<LeagueEntry, "participants">[] = [
  { league: "Diamante", color: "from-cyan-400 to-blue-500", icon: "💎", min_percent: 120, max_percent: null },
  { league: "Ouro", color: "from-yellow-400 to-amber-500", icon: "🥇", min_percent: 100, max_percent: 119.99 },
  { league: "Prata", color: "from-gray-300 to-gray-400", icon: "🥈", min_percent: 80, max_percent: 99.99 },
  { league: "Bronze", color: "from-orange-400 to-orange-600", icon: "🥉", min_percent: 50, max_percent: 79.99 },
  { league: "Iniciante", color: "from-green-400 to-emerald-500", icon: "🌱", min_percent: 0, max_percent: 49.99 },
];

export function useGlobalGamification() {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<GlobalParticipant[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
      const monthYear = format(selectedMonth, "yyyy-MM");

      // 1. Get staff emails to exclude them from gamification
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("email")
        .eq("is_active", true);

      const staffEmails = new Set(
        (staffData || []).map((s: any) => s.email?.toLowerCase()).filter(Boolean)
      );

      // 2. Get all active salespeople with company info
      const { data: salespeopleData } = await supabase
        .from("company_salespeople")
        .select(`
          id, name, company_id, email,
          unit_id, sector_id, team_id
        `)
        .eq("is_active", true);

      if (!salespeopleData?.length) {
        setParticipants([]);
        setCompanies([]);
        setLoading(false);
        return;
      }

      // Filter out salespeople who are staff members (by email)
      const filteredSalespeople = salespeopleData.filter(
        (sp: any) => !sp.email || !staffEmails.has(sp.email?.toLowerCase())
      );

      if (!filteredSalespeople.length) {
        setParticipants([]);
        setCompanies([]);
        setLoading(false);
        return;
      }

      // 2. Get company info
      const companyIds = [...new Set(filteredSalespeople.map((s) => s.company_id))];
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, name, segment")
        .in("id", companyIds);

      const companyMap = new Map(
        (companiesData || []).map((c: any) => [c.id, c])
      );

      // 3. Get KPIs marked as is_main_goal for each company
      const { data: mainKpis } = await supabase
        .from("company_kpis")
        .select("id, name, company_id")
        .eq("is_main_goal", true)
        .eq("is_active", true)
        .in("company_id", companyIds);

      if (!mainKpis?.length) {
        // No main KPIs configured, show empty state
        setParticipants([]);
        setCompanies([]);
        setLoading(false);
        return;
      }

      const kpiIds = mainKpis.map((k) => k.id);
      const kpiMap = new Map(mainKpis.map((k) => [k.id, k]));
      const companyKpiMap = new Map<string, any[]>();
      mainKpis.forEach((k) => {
        if (!companyKpiMap.has(k.company_id)) companyKpiMap.set(k.company_id, []);
        companyKpiMap.get(k.company_id)!.push(k);
      });

      // 4. Get KPI entries for the selected month
      const { data: entriesData } = await supabase
        .from("kpi_entries")
        .select("salesperson_id, kpi_id, value, company_id")
        .in("kpi_id", kpiIds)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd);

      // 5. Get targets for the selected month - ordered by level_order to pick base target
      const { data: targetsData } = await supabase
        .from("kpi_monthly_targets")
        .select("salesperson_id, kpi_id, target_value, company_id, unit_id, sector_id, team_id, level_order")
        .in("kpi_id", kpiIds)
        .eq("month_year", monthYear)
        .order("level_order", { ascending: true });

      // Build entries map: salesperson_id -> kpi_id -> total value
      const entriesMap = new Map<string, Map<string, number>>();
      (entriesData || []).forEach((e: any) => {
        if (!entriesMap.has(e.salesperson_id)) entriesMap.set(e.salesperson_id, new Map());
        const kpiMap = entriesMap.get(e.salesperson_id)!;
        kpiMap.set(e.kpi_id, (kpiMap.get(e.kpi_id) || 0) + (e.value || 0));
      });

      // Build targets lookup — only keep the base/lowest level_order per unique scope
      const targetsMap = new Map<string, any[]>();
      const seenScopes = new Set<string>();
      (targetsData || []).forEach((t: any) => {
        const scopeKey = `${t.company_id}_${t.kpi_id}_${t.salesperson_id || ''}_${t.team_id || ''}_${t.sector_id || ''}_${t.unit_id || ''}`;
        if (seenScopes.has(scopeKey)) return; // skip higher level_order duplicates
        seenScopes.add(scopeKey);

        const key = `${t.company_id}_${t.kpi_id}`;
        if (!targetsMap.has(key)) targetsMap.set(key, []);
        targetsMap.get(key)!.push(t);
      });

      // Helper to find target for a salesperson
      const getTargetForSalesperson = (
        salesperson: any,
        kpiId: string,
        companyId: string
      ): number => {
        const key = `${companyId}_${kpiId}`;
        const targets = targetsMap.get(key) || [];
        
        // Priority: individual > team > sector > unit > company-wide
        const individual = targets.find((t) => t.salesperson_id === salesperson.id);
        if (individual) return individual.target_value || 0;

        if (salesperson.team_id) {
          const team = targets.find((t) => t.team_id === salesperson.team_id && !t.salesperson_id);
          if (team) return team.target_value || 0;
        }

        if (salesperson.sector_id) {
          const sector = targets.find((t) => t.sector_id === salesperson.sector_id && !t.team_id && !t.salesperson_id);
          if (sector) return sector.target_value || 0;
        }

        if (salesperson.unit_id) {
          const unit = targets.find((t) => t.unit_id === salesperson.unit_id && !t.sector_id && !t.team_id && !t.salesperson_id);
          if (unit) return unit.target_value || 0;
        }

        // Company-wide fallback
        const companyWide = targets.find((t) => !t.salesperson_id && !t.team_id && !t.sector_id && !t.unit_id);
        if (companyWide) {
          // Divide by number of active salespeople in company
          const salespeopleInCompany = filteredSalespeople.filter((s) => s.company_id === companyId);
          return (companyWide.target_value || 0) / Math.max(salespeopleInCompany.length, 1);
        }

        return 0;
      };

      // 6. Calculate achievement for each salesperson
      const mappedParticipants: GlobalParticipant[] = [];

      filteredSalespeople.forEach((sp: any) => {
        const company = companyMap.get(sp.company_id);
        const companyKpis = companyKpiMap.get(sp.company_id) || [];
        
        if (!companyKpis.length) return; // Skip if company has no main KPIs

        let totalAchieved = 0;
        let totalTarget = 0;
        let kpiNames: string[] = [];

        companyKpis.forEach((kpi: any) => {
          const spEntries = entriesMap.get(sp.id);
          const achieved = spEntries?.get(kpi.id) || 0;
          const target = getTargetForSalesperson(sp, kpi.id, sp.company_id);
          
          totalAchieved += achieved;
          totalTarget += target;
          if (kpi.name) kpiNames.push(kpi.name);
        });

        const percent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

        mappedParticipants.push({
          id: sp.id,
          salesperson_id: sp.id,
          salesperson_name: sp.name,
          company_id: sp.company_id,
          company_name: company?.name || "Desconhecida",
          segment: company?.segment || null,
          total_achieved: totalAchieved,
          total_target: totalTarget,
          achievement_percent: Math.round(percent * 100) / 100, // 2 decimal places
          kpi_name: kpiNames.join(", "),
        });
      });

      // Sort by achievement percentage (highest first)
      mappedParticipants.sort((a, b) => b.achievement_percent - a.achievement_percent);

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
            total_achieved: 0,
            total_target: 0,
            avg_percent: 0,
            top_salesperson: "",
            top_percent: 0,
          });
        }
        const summary = companySummaries.get(p.company_id)!;
        summary.participant_count++;
        summary.total_achieved += p.total_achieved;
        summary.total_target += p.total_target;
        
        if (p.achievement_percent > summary.top_percent) {
          summary.top_percent = p.achievement_percent;
          summary.top_salesperson = p.salesperson_name;
        }
      });

      // Calculate avg percent for companies
      companySummaries.forEach((summary) => {
        summary.avg_percent = summary.total_target > 0 
          ? Math.round((summary.total_achieved / summary.total_target) * 10000) / 100
          : 0;
      });

      setCompanies(
        Array.from(companySummaries.values()).sort((a, b) => b.avg_percent - a.avg_percent)
      );
    } catch (error) {
      console.error("Error fetching global gamification data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

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

  // Leagues based on percentage
  const leagues: LeagueEntry[] = useMemo(() => {
    return LEAGUES.map((league) => ({
      ...league,
      participants: filteredParticipants.filter((p) => {
        if (league.max_percent === null) return p.achievement_percent >= league.min_percent;
        return p.achievement_percent >= league.min_percent && p.achievement_percent <= league.max_percent;
      }),
    }));
  }, [filteredParticipants]);

  // Hall of Fame (top 10)
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
    const totalAchieved = filteredParticipants.reduce((sum, p) => sum + p.total_achieved, 0);
    const totalTarget = filteredParticipants.reduce((sum, p) => sum + p.total_target, 0);
    const avgPercent = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 10000) / 100 : 0;
    const activeCompanies = new Set(filteredParticipants.map((p) => p.company_id)).size;
    const above100 = filteredParticipants.filter((p) => p.achievement_percent >= 100).length;
    return { total, totalAchieved, totalTarget, avgPercent, activeCompanies, above100 };
  }, [filteredParticipants]);

  return {
    loading,
    participants: filteredParticipants,
    allParticipants: participants,
    companies,
    leagues,
    hallOfFame,
    segments,
    stats,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedSegment,
    setSelectedSegment,
    selectedMonth,
    setSelectedMonth,
    refetch: fetchData,
  };
}
