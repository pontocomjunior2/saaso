export interface BusinessHoursConfig {
  enabled: boolean;
  timezone: string;    // e.g., "America/Sao_Paulo"
  days: number[];      // 0=Sun...6=Sat
  startHour: number;   // e.g., 8
  endHour: number;     // e.g., 18
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  enabled: true,
  timezone: 'America/Sao_Paulo',
  days: [1, 2, 3, 4, 5], // Mon-Fri
  startHour: 8,
  endHour: 18,
};

/**
 * Given a target Date and a BusinessHoursConfig, returns a Date that falls
 * within the configured business window. If the target is already within the
 * window it is returned unchanged. Otherwise it is advanced to the next valid
 * business day at startHour (in the configured timezone).
 *
 * When config is null/undefined or config.enabled is false, the target is
 * returned unchanged (always-open behaviour).
 */
export function nextBusinessHour(
  target: Date,
  config?: BusinessHoursConfig | null,
): Date {
  // No config or disabled → always open
  if (!config || !config.enabled) {
    return target;
  }

  const { timezone, days, startHour, endHour } = config;

  // Helper: extract local time parts in the given timezone using Intl
  function getLocalParts(d: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    weekday: number;
  } {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '';

    const year = parseInt(get('year'), 10);
    const month = parseInt(get('month'), 10) - 1; // 0-indexed
    const day = parseInt(get('day'), 10);
    const rawHour = parseInt(get('hour'), 10);
    const hour = rawHour === 24 ? 0 : rawHour; // Intl may return 24 for midnight
    const minute = parseInt(get('minute'), 10);
    const second = parseInt(get('second'), 10);

    // Derive weekday from the local calendar date.
    // Date.UTC(year, month, day) gives a UTC timestamp whose UTC date fields
    // match the local calendar date — weekday is the same in both.
    const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();

    return { year, month, day, hour, minute, second, weekday };
  }

  /**
   * Build a UTC timestamp representing local midnight (00:00:00) on the given
   * calendar date (year, month [0-indexed], day) in the configured timezone.
   *
   * Strategy: binary-search the UTC value whose Intl representation is
   * exactly 00:00:00 on the target local date. We use a fast single-step
   * correction that handles ±14h offsets reliably.
   */
  function localMidnightToUTC(year: number, month: number, day: number): Date {
    // Start with a UTC instant somewhere near local midnight.
    // Using UTC noon of that date gives us a safe anchor that won't cross
    // calendar-day boundaries for any realistic timezone offset (±14h max).
    const anchorUTC = Date.UTC(year, month, day, 12, 0, 0, 0); // UTC noon
    const anchor = new Date(anchorUTC);

    const local = getLocalParts(anchor);
    // Compute local noon's offset from midnight in that timezone
    // e.g., if local noon is 12:00 the offset is +12h relative to local midnight
    const localNoonHours = local.hour + local.minute / 60 + local.second / 3600;
    // local midnight UTC = UTC noon - local noon hours + 0 (midnight)
    // = anchorUTC - localNoonHours * 3600_000
    const midnightUTC = anchorUTC - localNoonHours * 3600_000;
    return new Date(midnightUTC);
  }

  // Check if target is already within business window
  const local = getLocalParts(target);
  const inValidDay = days.includes(local.weekday);
  const inValidHour = local.hour >= startHour && local.hour < endHour;

  if (inValidDay && inValidHour) {
    return target; // Already within window
  }

  // Advance to the next valid business window
  let { year, month, day, weekday } = local;

  // If today is a valid day but we are before startHour → same day at startHour
  if (inValidDay && local.hour < startHour) {
    const midnight = localMidnightToUTC(year, month, day);
    return new Date(midnight.getTime() + startHour * 3600_000);
  }

  // Otherwise advance day-by-day until we land on a valid weekday
  let iterations = 0;
  do {
    // Advance one calendar day
    const nextDay = new Date(Date.UTC(year, month, day + 1));
    year = nextDay.getUTCFullYear();
    month = nextDay.getUTCMonth();
    day = nextDay.getUTCDate();
    weekday = (weekday + 1) % 7;
    iterations++;
    if (iterations > 14) {
      // Safety: no valid day found in 2 weeks — return target unchanged
      return target;
    }
  } while (!days.includes(weekday));

  const midnight = localMidnightToUTC(year, month, day);
  return new Date(midnight.getTime() + startHour * 3600_000);
}
