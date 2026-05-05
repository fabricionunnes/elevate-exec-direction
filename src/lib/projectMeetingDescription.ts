/**
 * Builds a Google Calendar event description that includes a deep link
 * to the related project inside the system.
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
    const link = `${origin}/onboarding-tasks/${projectId}`;

    if (lines.length) lines.push("");
    lines.push("──────────────");
    lines.push("🔗 Acessar projeto no sistema:");
    if (options?.companyName) lines.push(options.companyName);
    lines.push(link);
  }

  return lines.join("\n");
}
