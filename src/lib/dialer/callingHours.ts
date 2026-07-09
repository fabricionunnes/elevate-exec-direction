// Horário permitido para telemarketing (legislação brasileira), em horário de Brasília:
// Seg-Sex 8h-20h, Sáb 9h-15h. Fora disso, o discador não opera.
export const CALLING_HOURS_MESSAGE =
  "Fora do horário permitido para telemarketing. Pela legislação brasileira, ligações só podem ser feitas de segunda a sexta das 8h às 20h e aos sábados das 9h às 15h (horário de Brasília).";

export function callingHoursStatus(date: Date = new Date()): { allowed: boolean; message: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", hour12: false,
  }).formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value || "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  if (weekdays.includes(wd) && hour >= 8 && hour < 20) return { allowed: true, message: "" };
  if (wd === "Sat" && hour >= 9 && hour < 15) return { allowed: true, message: "" };
  return { allowed: false, message: CALLING_HOURS_MESSAGE };
}
