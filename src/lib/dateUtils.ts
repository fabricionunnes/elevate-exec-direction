import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Parse a date string (YYYY-MM-DD) into a local Date object without timezone shifts.
 * This avoids the common issue where "2026-01-22" becomes "2026-01-21" due to UTC conversion.
 */
export function parseDateLocal(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Handle ISO datetime strings (with time component)
  if (dateString.includes("T")) {
    return parseISO(dateString);
  }
  
  // Handle date-only strings (YYYY-MM-DD) - parse as local date
  const parts = dateString.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  
  // Fallback
  return new Date(dateString);
}

/**
 * Parse a datetime string (ISO format with timezone) into a Date object
 * that displays correctly in the user's timezone.
 * 
 * For timestamps stored in UTC (like meeting_date with time), we want to:
 * - Display the correct local time for the user
 */
export function parseDateTimeLocal(dateTimeString: string): Date {
  if (!dateTimeString) return new Date();
  return new Date(dateTimeString);
}

/**
 * Format a date string (YYYY-MM-DD) for display, avoiding timezone issues.
 */
export function formatDateLocal(dateString: string, formatStr: string = "dd/MM/yyyy"): string {
  if (!dateString) return "";
  const date = parseDateLocal(dateString);
  return format(date, formatStr, { locale: ptBR });
}

/**
 * Format a datetime string (ISO format) for display with time.
 * Uses the browser's local timezone for display.
 */
export function formatDateTimeLocal(dateTimeString: string, formatStr: string = "dd/MM/yyyy 'às' HH:mm"): string {
  if (!dateTimeString) return "";
  const date = parseDateTimeLocal(dateTimeString);
  return format(date, formatStr, { locale: ptBR });
}

/**
 * Convert a local Date object to a date-only string (YYYY-MM-DD) for storage.
 * This preserves the local date without timezone conversion.
 */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert a local Date object to an ISO string for datetime storage.
 * The date is stored in UTC but will display correctly when parsed.
 */
export function toDateTimeString(date: Date): string {
  return date.toISOString();
}

/**
 * Create a Date object with specific time set, preserving the local date.
 * Useful for creating meeting start times from a date + time string.
 */
export function setLocalTime(date: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Check if two dates are on the same day (ignoring time).
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get today's date at midnight (local time).
 */
export function getTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
