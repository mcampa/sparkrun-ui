/**
 * Extract the "running for" portion of a docker-style status string.
 *
 * Examples:
 *   "Up 12 minutes"            -> "12 minutes"
 *   "Up About a minute"        -> "About a minute"
 *   "Up 3 hours (healthy)"     -> "3 hours"
 *   "Exited (0) 4 seconds ago" -> null
 */
export function parseWorkloadUptime(status?: string): string | null {
  if (!status) return null;
  const match = status.match(/^Up\s+(.+?)(?:\s*\([^)]*\))?\s*$/);
  return match?.[1] ?? null;
}
