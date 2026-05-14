/**
 * Builds a Google Calendar event description that includes a deep link
 * to the related project inside the system.
 *
 * Google Calendar's description field supports a limited subset of HTML
 * (including <b>), so we use it to highlight the company name.
 */
export function buildProjectEventDescription(
  baseDescription: string | null | undefined,
  projectId: string | null | undefined,
  options?: { companyName?: string | null }
): string {
  const lines: string[] = [];
  const trimmed = (baseDescription || "").trim();
  if (trimmed) lines.push(trimmed);

  if (projectId) {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://unvholdings.com.br";
    const link = `${origin}/#/onboarding-tasks/${projectId}`;

    if (lines.length) lines.push("");
    lines.push("──────────────");
    if (options?.companyName) {
      lines.push(`<b>${options.companyName}</b>`);
    }
    lines.push(link);
  }

  return lines.join("\n");
}
