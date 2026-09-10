/**
 * Prematch temporal firewall for research observations.
 * available_at > kickoff -> POST_KICKOFF (never enters independent model).
 */

export function isPostKickoff(availableAt: string | null | undefined, kickoffIso: string | null | undefined): boolean {
  if (!availableAt || !kickoffIso) return false;
  const a = Date.parse(availableAt);
  const k = Date.parse(kickoffIso);
  if (!Number.isFinite(a) || !Number.isFinite(k)) return false;
  return a > k;
}

export function asOfAfterKickoff(asOfIso: string, kickoffIso: string | null | undefined): boolean {
  if (!kickoffIso) return false;
  const a = Date.parse(asOfIso);
  const k = Date.parse(kickoffIso);
  if (!Number.isFinite(a) || !Number.isFinite(k)) return false;
  return a > k;
}
