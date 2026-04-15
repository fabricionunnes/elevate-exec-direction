/**
 * Returns today's date at midnight in Brasília time (UTC-3).
 * Used for overdue comparisons so tasks due "today" in BRT are NOT marked overdue.
 */
export function getTodayBrasilia(): Date {
  const now = new Date();
  // Get current date string in Brasília timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = +parts.find(p => p.type === "year")!.value;
  const month = +parts.find(p => p.type === "month")!.value - 1;
  const day = +parts.find(p => p.type === "day")!.value;

  // Return a Date at midnight UTC representing the start of today in Brasília
  return new Date(Date.UTC(year, month, day));
}

/**
 * Parses a date string (YYYY-MM-DD or with time) into a UTC midnight Date
 * for safe comparison with getTodayBrasilia().
 */
export function parseDateToUTCMidnight(dateStr: string): Date {
  // Extract just the date part (YYYY-MM-DD)
  const datePart = dateStr.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Check if a task is overdue based on Brasília time.
 */
export function isTaskOverdueBrasilia(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "completed") return false;
  const todayBRT = getTodayBrasilia();
  const taskDate = parseDateToUTCMidnight(dueDate);
  return taskDate < todayBRT;
}
