/**
 * Parse a duration string into milliseconds.
 * Supports: "1h", "30m", "7d", "1w", or ISO date string.
 */
export function parseDuration(input: string): number {
  const match = input.match(/^(\d+)(m|h|d|w)$/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };
    return value * multipliers[unit];
  }

  // Try as ISO date
  const date = new Date(input);
  if (!isNaN(date.getTime())) {
    const ms = date.getTime() - Date.now();
    if (ms <= 0) {
      throw new Error(`Expiry date "${input}" is in the past`);
    }
    return ms;
  }

  throw new Error(`Invalid duration: "${input}". Use format like "1h", "7d", or an ISO date.`);
}

/**
 * Parse duration to an expiry Date.
 */
export function parseExpiry(input: string): Date {
  return new Date(Date.now() + parseDuration(input));
}
