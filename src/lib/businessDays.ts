// Feriados nacionais brasileiros (fixos e móveis para 2024-2028)
const BRAZILIAN_HOLIDAYS: Record<number, string[]> = {
  2024: [
    "2024-01-01", // Ano Novo
    "2024-02-12", // Carnaval
    "2024-02-13", // Carnaval
    "2024-03-29", // Sexta-feira Santa
    "2024-04-21", // Tiradentes
    "2024-05-01", // Dia do Trabalhador
    "2024-05-30", // Corpus Christi
    "2024-09-07", // Independência
    "2024-10-12", // Nossa Senhora Aparecida
    "2024-11-02", // Finados
    "2024-11-15", // Proclamação da República
    "2024-11-20", // Consciência Negra
    "2024-12-25", // Natal
  ],
  2025: [
    "2025-01-01", // Ano Novo
    "2025-03-03", // Carnaval
    "2025-03-04", // Carnaval
    "2025-04-18", // Sexta-feira Santa
    "2025-04-21", // Tiradentes
    "2025-05-01", // Dia do Trabalhador
    "2025-06-19", // Corpus Christi
    "2025-09-07", // Independência
    "2025-10-12", // Nossa Senhora Aparecida
    "2025-11-02", // Finados
    "2025-11-15", // Proclamação da República
    "2025-11-20", // Consciência Negra
    "2025-12-25", // Natal
  ],
  2026: [
    "2026-01-01", // Ano Novo
    "2026-02-16", // Carnaval
    "2026-02-17", // Carnaval
    "2026-04-03", // Sexta-feira Santa
    "2026-04-21", // Tiradentes
    "2026-05-01", // Dia do Trabalhador
    "2026-06-04", // Corpus Christi
    "2026-09-07", // Independência
    "2026-10-12", // Nossa Senhora Aparecida
    "2026-11-02", // Finados
    "2026-11-15", // Proclamação da República
    "2026-11-20", // Consciência Negra
    "2026-12-25", // Natal
  ],
  2027: [
    "2027-01-01", // Ano Novo
    "2027-02-08", // Carnaval
    "2027-02-09", // Carnaval
    "2027-03-26", // Sexta-feira Santa
    "2027-04-21", // Tiradentes
    "2027-05-01", // Dia do Trabalhador
    "2027-05-27", // Corpus Christi
    "2027-09-07", // Independência
    "2027-10-12", // Nossa Senhora Aparecida
    "2027-11-02", // Finados
    "2027-11-15", // Proclamação da República
    "2027-11-20", // Consciência Negra
    "2027-12-25", // Natal
  ],
  2028: [
    "2028-01-01", // Ano Novo
    "2028-02-28", // Carnaval
    "2028-02-29", // Carnaval
    "2028-04-14", // Sexta-feira Santa
    "2028-04-21", // Tiradentes
    "2028-05-01", // Dia do Trabalhador
    "2028-06-15", // Corpus Christi
    "2028-09-07", // Independência
    "2028-10-12", // Nossa Senhora Aparecida
    "2028-11-02", // Finados
    "2028-11-15", // Proclamação da República
    "2028-11-20", // Consciência Negra
    "2028-12-25", // Natal
  ],
};

// Helper: Check if date is a weekend
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

// Helper: Check if date is a Brazilian holiday
export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const dateStr = date.toISOString().split("T")[0];
  const holidays = BRAZILIAN_HOLIDAYS[year] || [];
  return holidays.includes(dateStr);
}

// Helper: Check if date is a business day
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

// Helper: Get next business day from a given date (if current is not business day)
export function getNextBusinessDay(date: Date): Date {
  const result = new Date(date);
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

// Helper: Add N business days to a date
export function addBusinessDays(startDate: Date, days: number): Date {
  let currentDate = new Date(startDate);
  let addedDays = 0;
  
  while (addedDays < days) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isBusinessDay(currentDate)) {
      addedDays++;
    }
  }
  
  return currentDate;
}

// Helper: Ensure a date is on a business day (move to next if not)
export function ensureBusinessDay(date: Date): Date {
  return getNextBusinessDay(date);
}

// Helper: Count business days remaining in month (excluding today)
export function getRemainingBusinessDaysInMonth(fromDate: Date): number {
  const year = fromDate.getFullYear();
  const month = fromDate.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  let count = 0;
  const current = new Date(fromDate);
  current.setDate(current.getDate() + 1); // Start from tomorrow
  
  while (current <= lastDayOfMonth) {
    if (isBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}
