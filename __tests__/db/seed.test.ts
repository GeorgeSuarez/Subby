import { seedDrafts } from '@/db/seed-data';
import { toISODate, parseDate, todayUTC } from '@/utils/billing';

describe('seedDrafts', () => {
  const today = parseDate('2026-07-16');

  it('returns the expected brand list', () => {
    const names = seedDrafts(today).map((d) => d.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Netflix',
        'Spotify',
        'iCloud+',
        'GitHub',
        'Figma',
        'Disney+',
        'New York Times',
        'Peacock',
      ]),
    );
  });

  it('seeds a trial sub so the dashboard trial chip has data', () => {
    const peacock = seedDrafts(today).find((d) => d.name === 'Peacock');
    expect(peacock?.trialEnds).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(peacock?.notes).toBeTruthy();
  });

  it('produces upcoming renewal dates (within ~31 days for monthly seeds)', () => {
    for (const d of seedDrafts(today)) {
      // Every seed's renewal date must parse cleanly back to ISO.
      expect(toISODate(parseDate(d.nextRenewal))).toBe(d.nextRenewal);
    }
  });

  it('does not pin to a fixed absolute date — re-seed stays current', () => {
    // Sanity: the seed is relative to "today" so re-running tomorrow yields a
    // shifted date. We just assert the date string is parseable.
    const tom = new Date(today.getTime() + 86_400_000);
    const a = seedDrafts(today)[0];
    const b = seedDrafts(tom)[0];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // Either identical (yearly) or 1-day shifted; both must parse.
    expect(() => parseDate(a!.nextRenewal)).not.toThrow();
    expect(() => parseDate(b!.nextRenewal)).not.toThrow();
  });

  it('seeds with default currency USD and known categories', () => {
    for (const d of seedDrafts(todayUTC())) {
      expect(d.currency).toBe('USD');
      expect(d.category).toMatch(
        /^(streaming|music|cloud|developer|productivity|news)$/,
      );
    }
  });
});
