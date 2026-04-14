import {
  BusinessHoursConfig,
  DEFAULT_BUSINESS_HOURS,
  nextBusinessHour,
} from './business-hours';

// Mon-Fri 08:00-18:00 America/Sao_Paulo (UTC-3)
const CONFIG: BusinessHoursConfig = {
  enabled: true,
  timezone: 'America/Sao_Paulo',
  days: [1, 2, 3, 4, 5],
  startHour: 8,
  endHour: 18,
};

/**
 * Create a Date from a local time string in America/Sao_Paulo (UTC-3).
 * Simple helper: treat the offset as fixed -03:00 for test purposes.
 */
function saoPaulo(isoLocal: string): Date {
  // Append -03:00 offset to get the UTC equivalent
  return new Date(`${isoLocal}-03:00`);
}

describe('nextBusinessHour', () => {
  it('returns target unchanged when it is within business window (Mon 10:00)', () => {
    // 2026-04-13 is a Monday
    const target = saoPaulo('2026-04-13T10:00:00');
    const result = nextBusinessHour(target, CONFIG);
    expect(result.getTime()).toBe(target.getTime());
  });

  it('returns Monday 08:00 when target is Saturday 10:00', () => {
    // 2026-04-11 is a Saturday
    const target = saoPaulo('2026-04-11T10:00:00');
    const result = nextBusinessHour(target, CONFIG);
    // Next Monday is 2026-04-13
    const expected = saoPaulo('2026-04-13T08:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('returns Monday 08:00 when target is Sunday 15:00', () => {
    // 2026-04-12 is a Sunday
    const target = saoPaulo('2026-04-12T15:00:00');
    const result = nextBusinessHour(target, CONFIG);
    // Next Monday is 2026-04-13
    const expected = saoPaulo('2026-04-13T08:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('returns Tuesday 08:00 when target is Monday 20:00 (after endHour)', () => {
    // 2026-04-13 Monday 20:00 → next day Tuesday 08:00
    const target = saoPaulo('2026-04-13T20:00:00');
    const result = nextBusinessHour(target, CONFIG);
    const expected = saoPaulo('2026-04-14T08:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('returns Monday 08:00 when target is Friday 19:00 (after endHour, weekend ahead)', () => {
    // 2026-04-10 is a Friday
    const target = saoPaulo('2026-04-10T19:00:00');
    const result = nextBusinessHour(target, CONFIG);
    // Next Monday is 2026-04-13
    const expected = saoPaulo('2026-04-13T08:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('returns Monday 08:00 when target is Monday 06:00 (before startHour)', () => {
    // 2026-04-13 Monday 06:00 → same day at 08:00
    const target = saoPaulo('2026-04-13T06:00:00');
    const result = nextBusinessHour(target, CONFIG);
    const expected = saoPaulo('2026-04-13T08:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('returns target unchanged when config is null (always open)', () => {
    const target = saoPaulo('2026-04-11T10:00:00'); // Saturday
    const result = nextBusinessHour(target, null);
    expect(result.getTime()).toBe(target.getTime());
  });

  it('returns target unchanged when config is undefined (always open)', () => {
    const target = saoPaulo('2026-04-11T10:00:00'); // Saturday
    const result = nextBusinessHour(target, undefined);
    expect(result.getTime()).toBe(target.getTime());
  });

  it('returns target unchanged when config.enabled is false', () => {
    const target = saoPaulo('2026-04-11T10:00:00'); // Saturday
    const result = nextBusinessHour(target, { ...CONFIG, enabled: false });
    expect(result.getTime()).toBe(target.getTime());
  });

  it('DEFAULT_BUSINESS_HOURS has expected values', () => {
    expect(DEFAULT_BUSINESS_HOURS.enabled).toBe(true);
    expect(DEFAULT_BUSINESS_HOURS.timezone).toBe('America/Sao_Paulo');
    expect(DEFAULT_BUSINESS_HOURS.days).toEqual([1, 2, 3, 4, 5]);
    expect(DEFAULT_BUSINESS_HOURS.startHour).toBe(8);
    expect(DEFAULT_BUSINESS_HOURS.endHour).toBe(18);
  });
});
